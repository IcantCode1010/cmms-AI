import { Box, Button, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { KeyboardEvent } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

/**
 * Message input component with send button.
 * Supports multiline text input and keyboard shortcuts.
 * Enter submits, Shift+Enter creates new line.
 */
const MessageInput = ({
  value,
  onChange,
  onSubmit,
  disabled
}: MessageInputProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <Box
      sx={{
        px: { xs: 3, md: 5 },
        py: 2,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          fullWidth
          multiline
          minRows={1}
          maxRows={4}
          placeholder="Ask me about maintenance..."
          size="small"
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2
            }
          }}
        />
        <Button
          variant="contained"
          disabled={disabled || !value.trim()}
          onClick={onSubmit}
          endIcon={<SendIcon fontSize="small" />}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            textTransform: 'none'
          }}
        >
          Send
        </Button>
      </Box>
      <Box sx={{ mt: 0.5, px: 0.5 }}>
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary'
          }}
        >
          Press Enter to send, Shift+Enter for new line
        </Box>
      </Box>
    </Box>
  );
};

export default MessageInput;
