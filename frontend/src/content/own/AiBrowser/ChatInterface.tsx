import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useAgentChatContext } from 'src/contexts/AgentChatContext';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import DraftActionPanel from './components/DraftActionPanel';
import MessageInput from './components/MessageInput';

/**
 * Main chat interface component for the AI Browser.
 * Integrates all chat components and manages message flow.
 */
const ChatInterface = () => {
  const {
    messages,
    drafts,
    toolCalls,
    sending,
    loadingDrafts,
    error,
    sessionId,
    sendMessage,
    confirmDraft,
    declineDraft,
    refreshDrafts
  } = useAgentChatContext();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages, sending, drafts]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || sending) {
      return;
    }
    sendMessage(trimmed);
    setInputValue('');
  }, [inputValue, sending, sendMessage]);

  const handleClear = useCallback(() => {
    // Clear messages by reloading page (simple approach)
    // Alternative: Add clearMessages action to agentChat slice
    if (window.confirm('Clear all messages? This will reload the page.')) {
      window.localStorage.removeItem('atlas-agent-chat-state');
      window.location.reload();
    }
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        bgcolor: 'background.default'
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRadius: { xs: 0, md: 3 },
          border: { xs: 'none', md: (theme) => `1px solid ${theme.palette.divider}` },
          background:
            'linear-gradient(180deg, rgba(248,249,255,0.9) 0%, rgba(255,255,255,0.98) 40%, #ffffff 100%)',
          boxShadow: { xs: 'none', md: '0 35px 80px rgba(15, 23, 42, 0.12)' },
          m: { xs: 0, md: 3 },
          overflow: 'hidden'
        }}
      >
        <ChatHeader
          sessionId={sessionId}
          hasMessages={hasMessages}
          loadingDrafts={loadingDrafts}
          onRefresh={refreshDrafts}
          onClear={handleClear}
        />

        <MessageList
          messages={messages}
          toolCalls={toolCalls}
          sending={sending}
          error={error}
          endRef={messagesEndRef}
        />

        <DraftActionPanel
          drafts={drafts}
          onConfirm={confirmDraft}
          onDecline={declineDraft}
          loading={loadingDrafts}
        />

        <MessageInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          disabled={sending}
        />
      </Box>
    </Box>
  );
};

export default ChatInterface;
