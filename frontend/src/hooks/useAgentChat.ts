import { useCallback } from 'react';
import { useDispatch, useSelector } from 'src/store';
import {
  confirmDraft as confirmDraftAction,
  declineDraft as declineDraftAction,
  loadDrafts,
  selectAgentChat,
  sendPrompt,
  toggleDock
} from 'src/slices/agentChat';

/**
 * Hook for interacting with the agent chat system.
 * Provides access to chat state and actions for sending messages,
 * managing draft actions, and controlling the chat interface.
 */
export function useAgentChat() {
  const dispatch = useDispatch();
  const chat = useSelector(selectAgentChat);

  const sendMessage = useCallback(
    (prompt: string) => {
      dispatch(sendPrompt(prompt));
    },
    [dispatch]
  );

  const confirmDraft = useCallback(
    (draftId: number) => {
      dispatch(confirmDraftAction(draftId));
    },
    [dispatch]
  );

  const declineDraft = useCallback(
    (draftId: number) => {
      dispatch(declineDraftAction(draftId));
    },
    [dispatch]
  );

  const refreshDrafts = useCallback(() => {
    dispatch(loadDrafts());
  }, [dispatch]);

  const toggleChat = useCallback(
    (open: boolean) => {
      dispatch(toggleDock(open));
    },
    [dispatch]
  );

  return {
    ...chat,
    sendMessage,
    confirmDraft,
    declineDraft,
    refreshDrafts,
    toggleChat
  };
}
