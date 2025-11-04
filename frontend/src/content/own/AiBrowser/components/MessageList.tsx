import { Box, CircularProgress, Typography } from '@mui/material';
import { MutableRefObject } from 'react';
import type { AgentChatMessage, AgentToolCall } from 'src/types/agentChat';
import MessageBubble from './MessageBubble';
import ToolCallActivity from './ToolCallActivity';

interface MessageListProps {
  messages: AgentChatMessage[];
  toolCalls: AgentToolCall[];
  sending: boolean;
  error?: string;
  endRef: MutableRefObject<HTMLDivElement | null>;
}

/**
 * Scrollable message list component.
 * Displays conversation history, tool activity, and loading states.
 */
const MessageList = ({
  messages,
  toolCalls,
  sending,
  error,
  endRef
}: MessageListProps) => {
  const hasMessages = messages.length > 0;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        px: { xs: 3, md: 5 },
        py: { xs: 3, md: 4 },
        background:
          'linear-gradient(180deg, rgba(248,249,255,0.85) 0%, rgba(255,255,255,0.95) 60%, #ffffff 100%)'
      }}
    >
      {!hasMessages && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            textAlign: 'center',
            px: 2
          }}
        >
          <Typography
            variant="h5"
            fontWeight={600}
            gutterBottom
            sx={{ color: 'text.primary' }}
          >
            Welcome to Atlas Assistant
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
            Ask about open work orders, inventory, or request a draft action
            (for example "close my highest priority work order").
          </Typography>
        </Box>
      )}

      {hasMessages && (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {messages.map((message, index) => (
            <MessageBubble
              key={`${message.role}-${index}`}
              message={message}
              isUser={message.role === 'user'}
            />
          ))}

          {toolCalls.length > 0 && <ToolCallActivity calls={toolCalls.slice(-5)} />}

          {sending && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Thinking...
              </Typography>
            </Box>
          )}

          {error && (
            <Box
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                bgcolor: '#ffebee',
                border: (theme) => `1px solid ${theme.palette.error.main}`
              }}
            >
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            </Box>
          )}

          <div ref={endRef} />
        </Box>
      )}
    </Box>
  );
};

export default MessageList;
