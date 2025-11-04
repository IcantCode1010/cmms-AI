import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { chatkitAgentId, chatkitEnabled } from 'src/config';
import type { AppThunk, RootState } from 'src/store';
import type {
  AgentChatMessage,
  AgentChatResponse,
  AgentDraftAction,
  AgentToolCall
} from 'src/types/agentChat';
import {
  postChat,
  getDrafts as fetchDrafts,
  confirmDraft as confirmDraftRequest,
  declineDraft as declineDraftRequest
} from 'src/utils/agentApi';

const CHAT_STORAGE_KEY = 'atlas-agent-chat-state';
const CHAT_HISTORY_LIMIT = 20;
const CHAT_MEMORY_TTL_MS = (() => {
  const raw =
    typeof process !== 'undefined'
      ? process.env.REACT_APP_AGENT_MEMORY_TTL_MS
      : undefined;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60 * 1000;
})();

const isBrowser =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

interface AgentChatState {
  enabled: boolean;
  open: boolean;
  sending: boolean;
  loadingDrafts: boolean;
  messages: AgentChatMessage[];
  drafts: AgentDraftAction[];
  toolCalls: AgentToolCall[];
  error?: string;
  agentId?: string;
  sessionId?: string;
  correlationId?: string;
}

type PersistedAgentChatState = {
  sessionId?: string;
  messages?: AgentChatMessage[];
  updatedAt?: number;
};

const pruneMessages = (messages: AgentChatMessage[]): AgentChatMessage[] =>
  messages.length > CHAT_HISTORY_LIMIT
    ? messages.slice(-CHAT_HISTORY_LIMIT)
    : messages;

const loadPersistedState = (): Partial<AgentChatState> => {
  if (!isBrowser) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PersistedAgentChatState;
    if (
      !parsed.updatedAt ||
      Date.now() - parsed.updatedAt > CHAT_MEMORY_TTL_MS
    ) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return {};
    }
    return {
      sessionId: parsed.sessionId,
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Failed to load agent chat state', error);
    }
    return {};
  }
};

const persistChatState = (state: AgentChatState) => {
  if (!isBrowser) {
    return;
  }
  try {
    if (!state.sessionId && state.messages.length === 0) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }
    const payload: PersistedAgentChatState = {
      sessionId: state.sessionId,
      messages: pruneMessages(state.messages),
      updatedAt: Date.now()
    };
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist agent chat state', error);
    }
  }
};

const persistedSnapshot = loadPersistedState();

const initialState: AgentChatState = {
  enabled: chatkitEnabled,
  open: false,
  sending: false,
  loadingDrafts: false,
  messages: persistedSnapshot.messages ?? [],
  drafts: [],
  toolCalls: [],
  agentId: chatkitAgentId || undefined,
  sessionId: persistedSnapshot.sessionId || undefined,
  correlationId: undefined,
  error: undefined
};

const slice = createSlice({
  name: 'agentChat',
  initialState,
  reducers: {
    setOpen(state, action: PayloadAction<{ open: boolean }>) {
      state.open = action.payload.open;
    },
    promptQueued(state, action: PayloadAction<{ prompt: string }>) {
      if (!state.enabled) {
        state.error = 'Chat assistant is disabled for this environment.';
        return;
      }
      state.sending = true;
      state.error = undefined;
      state.messages.push({
        role: 'user',
        content: action.payload.prompt
      });
    },
    promptSuccess(
      state,
      action: PayloadAction<{ response: AgentChatResponse }>
    ) {
      state.sending = false;
      state.loadingDrafts = false;
      const { response } = action.payload;
      state.agentId = response.agentId || state.agentId;
      state.correlationId = response.correlationId || state.correlationId;
      state.sessionId = response.sessionId || state.sessionId;

      if (response.status && response.status !== 'success') {
        state.error = response.message || 'Agent runtime unavailable.';
        return;
      }

      state.error = undefined;
      if (response.messages && response.messages.length) {
        state.messages = state.messages.concat(response.messages);
      }
      state.drafts = response.drafts || [];
      state.toolCalls = response.toolCalls || [];
    },
    promptFailure(state, action: PayloadAction<{ error: string }>) {
      state.sending = false;
      state.loadingDrafts = false;
      state.error = action.payload.error;
    },
    draftsLoaded(state, action: PayloadAction<{ drafts: AgentDraftAction[] }>) {
      state.drafts = action.payload.drafts;
      state.loadingDrafts = false;
    },
    draftsLoading(state) {
      state.loadingDrafts = true;
    },
    draftResolved(state, action: PayloadAction<{ draftId: number }>) {
      state.drafts = state.drafts.filter(
        (draft) => draft.id !== action.payload.draftId
      );
    }
  }
});

export const reducer = slice.reducer;

export const toggleDock =
  (open: boolean): AppThunk =>
    async (dispatch, getState) => {
      dispatch(slice.actions.setOpen({ open }));
      if (open && getState().agentChat.enabled) {
        dispatch(loadDrafts());
      }
    };

export const sendPrompt =
  (prompt: string): AppThunk =>
    async (dispatch, getState) => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        return;
      }
      if (!getState().agentChat.enabled) {
        dispatch(
          slice.actions.promptFailure({
            error: 'Chat assistant is disabled for this environment.'
          })
        );
        return;
      }
      dispatch(slice.actions.promptQueued({ prompt: trimmed }));
      persistChatState(getState().agentChat);
      try {
        const {
          agentId,
          messages,
          sessionId
        } = getState().agentChat;
        const metadata: Record<string, unknown> = {
          source: 'web',
          messageCount: messages.length
        };
        if (sessionId) {
          metadata.sessionId = sessionId;
        }
        const payload = await postChat<AgentChatResponse>({
          prompt: trimmed,
          agentId,
          sessionId,
          metadata: {
            ...metadata
          }
        });
        dispatch(slice.actions.promptSuccess({ response: payload }));
        persistChatState(getState().agentChat);
      } catch (error) {
        dispatch(
          slice.actions.promptFailure({
            error:
              error instanceof Error
                ? error.message
                : 'Unable to reach the agent runtime.'
          })
        );
        persistChatState(getState().agentChat);
      }
    };

export const loadDrafts =
  (): AppThunk =>
    async (dispatch, getState) => {
      if (!getState().agentChat.enabled) {
        return;
      }
      dispatch(slice.actions.draftsLoading());
      try {
        const drafts = await fetchDrafts<AgentDraftAction[]>();
        dispatch(slice.actions.draftsLoaded({ drafts }));
      } catch (error) {
        dispatch(slice.actions.promptFailure({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to load agent drafts.'
        }));
      }
    };

export const confirmDraft =
  (draftId: number): AppThunk =>
    async (dispatch) => {
      try {
        await confirmDraftRequest<AgentDraftAction>(draftId);
        dispatch(slice.actions.draftResolved({ draftId }));
      } catch (error) {
        dispatch(
          slice.actions.promptFailure({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to confirm draft action.'
          })
        );
      }
    };

export const declineDraft =
  (draftId: number): AppThunk =>
    async (dispatch) => {
      try {
        await declineDraftRequest<AgentDraftAction>(draftId);
        dispatch(slice.actions.draftResolved({ draftId }));
      } catch (error) {
        dispatch(
          slice.actions.promptFailure({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to decline draft action.'
          })
        );
      }
    };

export const selectAgentChat = (state: RootState) => state.agentChat;

export default slice;
