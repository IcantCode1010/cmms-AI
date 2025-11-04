import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo
} from 'react';
import type {
  AgentChatMessage,
  AgentDraftAction,
  AgentToolCall
} from 'src/types/agentChat';
import { useAgentChat } from 'src/hooks/useAgentChat';

/**
 * Context value for agent chat functionality.
 * Provides access to chat state and actions throughout the component tree.
 */
export interface AgentChatContextValue {
  messages: AgentChatMessage[];
  drafts: AgentDraftAction[];
  toolCalls: AgentToolCall[];
  sending: boolean;
  loadingDrafts: boolean;
  error?: string;
  sessionId?: string;
  enabled: boolean;
  sendMessage: (prompt: string) => void;
  confirmDraft: (draftId: number) => void;
  declineDraft: (draftId: number) => void;
  refreshDrafts: () => void;
  clearError: () => void;
}

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

/**
 * Hook to access agent chat context.
 * Must be used within an AgentChatProvider.
 */
export function useAgentChatContext(): AgentChatContextValue {
  const context = useContext(AgentChatContext);
  if (!context) {
    throw new Error(
      'useAgentChatContext must be used within an AgentChatProvider'
    );
  }
  return context;
}

interface ProviderProps {
  children: ReactNode;
}

/**
 * Provider component for agent chat functionality.
 * Wraps the application or specific routes to provide chat state and actions.
 */
export function AgentChatProvider({ children }: ProviderProps) {
  const chat = useAgentChat();

  // Auto-refresh drafts when provider mounts
  useEffect(() => {
    if (chat.enabled) {
      chat.refreshDrafts();
    }
  }, [chat.enabled]); // Only run on mount/enabled change

  const clearError = useCallback(() => {
    // Error clearing happens automatically on next message send
    // This is a no-op placeholder for future implementation
  }, []);

  const value = useMemo<AgentChatContextValue>(
    () => ({
      messages: chat.messages,
      drafts: chat.drafts,
      toolCalls: chat.toolCalls,
      sending: chat.sending,
      loadingDrafts: chat.loadingDrafts,
      error: chat.error,
      sessionId: chat.sessionId,
      enabled: chat.enabled,
      sendMessage: chat.sendMessage,
      confirmDraft: chat.confirmDraft,
      declineDraft: chat.declineDraft,
      refreshDrafts: chat.refreshDrafts,
      clearError
    }),
    [
      chat.messages,
      chat.drafts,
      chat.toolCalls,
      chat.sending,
      chat.loadingDrafts,
      chat.error,
      chat.sessionId,
      chat.enabled,
      chat.sendMessage,
      chat.confirmDraft,
      chat.declineDraft,
      chat.refreshDrafts,
      clearError
    ]
  );

  return (
    <AgentChatContext.Provider value={value}>
      {children}
    </AgentChatContext.Provider>
  );
}

export default AgentChatContext;
