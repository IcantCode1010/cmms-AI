import { Box, Chip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import type { AgentToolCall } from 'src/types/agentChat';

interface ToolCallActivityProps {
  calls: AgentToolCall[];
}

/**
 * Displays recent tool call activity inline with chat messages.
 * Shows tool name, status, and result count for successful calls.
 */
const ToolCallActivity = ({ calls }: ToolCallActivityProps) => {
  if (calls.length === 0) {
    return null;
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return <HourglassEmptyIcon fontSize="small" color="info" />;
    }
  };

  const getStatusColor = (status?: string): 'success' | 'error' | 'info' => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        mb: 2,
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.grey[50],
        border: (theme) => `1px solid ${theme.palette.divider}`
      }}
    >
      <Typography variant="overline" color="text.secondary" display="block" mb={1}>
        Tool Activity
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {calls.map((call, index) => (
          <Chip
            key={`${call.toolName}-${index}`}
            icon={getStatusIcon(call.status)}
            label={
              call.status === 'success'
                ? `${call.toolName}: ${call.resultCount || 0} results`
                : call.status === 'error'
                  ? `${call.toolName}: ${call.error || 'failed'}`
                  : `${call.toolName}: pending`
            }
            size="small"
            color={getStatusColor(call.status)}
            variant="outlined"
          />
        ))}
      </Box>
    </Box>
  );
};

export default ToolCallActivity;
