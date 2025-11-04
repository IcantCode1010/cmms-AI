import { Box, Button, CircularProgress, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearAllIcon from '@mui/icons-material/ClearAll';

interface ChatHeaderProps {
  sessionId?: string;
  hasMessages: boolean;
  loadingDrafts: boolean;
  onRefresh: () => void;
  onClear: () => void;
}

/**
 * Header component for the agent chat interface.
 * Displays session information and provides refresh/clear actions.
 */
const ChatHeader = ({
  sessionId,
  hasMessages,
  loadingDrafts,
  onRefresh,
  onClear
}: ChatHeaderProps) => {
  return (
    <Box
      sx={{
        px: { xs: 3, md: 5 },
        py: 2,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Box>
        <Typography variant="h6" fontWeight={600}>
          Atlas Assistant
        </Typography>
        {sessionId && (
          <Typography variant="caption" color="text.secondary">
            Session: {sessionId.slice(0, 8)}...
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {loadingDrafts && <CircularProgress size={20} />}

        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={loadingDrafts}
        >
          Refresh
        </Button>

        {hasMessages && (
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<ClearAllIcon />}
            onClick={onClear}
          >
            Clear
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ChatHeader;
