import { Box, Button, Collapse, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { AgentDraftAction } from 'src/types/agentChat';

interface DraftActionPanelProps {
  drafts: AgentDraftAction[];
  onConfirm: (draftId: number) => void;
  onDecline: (draftId: number) => void;
  loading: boolean;
}

const parseDraftPayload = (payload: string): { summary?: string; data?: unknown } => {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return {};
  }
};

/**
 * Panel for displaying and managing pending draft actions.
 * Users can confirm or decline proposed actions from the agent.
 */
const DraftActionPanel = ({
  drafts,
  onConfirm,
  onDecline,
  loading
}: DraftActionPanelProps) => {
  const [expanded, setExpanded] = useState(true);

  if (drafts.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: (theme) => theme.palette.background.paper
      }}
    >
      <Box
        sx={{
          px: { xs: 3, md: 5 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: (theme) => theme.palette.action.hover
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Pending Actions ({drafts.length})
        </Typography>
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: { xs: 3, md: 5 }, pb: 2 }}>
          <List dense disablePadding>
            {drafts.map((draft) => {
              const parsed = parseDraftPayload(draft.payload);
              const summary =
                (parsed?.summary as string) ||
                `Confirm ${draft.operationType.replace(/_/g, ' ')}`;

              return (
                <ListItem
                  key={draft.id}
                  disableGutters
                  sx={{
                    mb: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    backgroundColor: (theme) => theme.palette.grey[50]
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600}>
                        {summary}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        Session {draft.agentSessionId}
                      </Typography>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => onConfirm(draft.id)}
                      disabled={loading}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={() => onDecline(draft.id)}
                      disabled={loading}
                    >
                      Decline
                    </Button>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Collapse>
    </Box>
  );
};

export default DraftActionPanel;
