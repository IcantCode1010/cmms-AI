import { Box, Typography } from '@mui/material';
import type { AgentChatMessage } from 'src/types/agentChat';
import MarkdownMessage from 'src/components/ChatDock/MarkdownMessage';

interface MessageBubbleProps {
  message: AgentChatMessage;
  isUser: boolean;
}

/**
 * Individual message bubble component.
 * Renders user messages with right alignment and primary color,
 * assistant messages with left alignment and markdown support.
 */
const MessageBubble = ({ message, isUser }: MessageBubbleProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          maxWidth: '85%',
          borderRadius: 2,
          bgcolor: isUser
            ? (theme) => theme.palette.primary.main
            : (theme) => theme.palette.grey[100],
          color: isUser ? 'primary.contrastText' : 'text.primary',
          boxShadow: isUser
            ? '0 2px 8px rgba(85, 105, 255, 0.2)'
            : '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}
      >
        {isUser ? (
          <Typography variant="body2">{message.content}</Typography>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </Box>
    </Box>
  );
};

export default MessageBubble;

