import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ForumIcon from '@mui/icons-material/Forum';
import SendIcon from '@mui/icons-material/Send';
import type { AgentDraftAction } from 'src/types/agentChat';
import { useDispatch, useSelector } from 'src/store';
import {
  confirmDraft,
  declineDraft,
  loadDrafts,
  selectAgentChat,
  sendPrompt,
  toggleDock
} from 'src/slices/agentChat';

const parseDraftPayload = (payload: string): { summary?: string; data?: unknown } => {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return {};
  }
};

const DraftList = ({
  drafts,
  onConfirm,
  onDecline
}: {
  drafts: AgentDraftAction[];
  onConfirm: (draft: AgentDraftAction) => void;
  onDecline: (draft: AgentDraftAction) => void;
}) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="subtitle2" gutterBottom>
      Pending actions
    </Typography>
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
                onClick={() => onConfirm(draft)}
              >
                Confirm
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => onDecline(draft)}
              >
                Decline
              </Button>
            </Box>
          </ListItem>
        );
      })}
    </List>
  </Box>
);

const ToolCallSummary = ({
  label,
  value
}: {
  label: string;
  value: string;
}) => (
  <Typography
    component="div"
    variant="caption"
    color="text.secondary"
    sx={{ display: 'flex', justifyContent: 'space-between' }}
  >
    <span>{label}</span>
    <span>{value}</span>
  </Typography>
);

const ChatDock = () => {
  const dispatch = useDispatch();
  const {
    enabled,
    open,
    messages,
    sending,
    drafts,
    toolCalls,
    error,
    loadingDrafts
  } = useSelector(selectAgentChat);
  const [prompt, setPrompt] = useState('');

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = prompt.trim();
      if (!trimmed) {
        return;
      }
      dispatch(sendPrompt(trimmed));
      setPrompt('');
    },
    [dispatch, prompt]
  );

  const handleToggle = useCallback(() => {
    dispatch(toggleDock(!open));
  }, [dispatch, open]);

  const handleConfirmDraft = useCallback(
    (draft: AgentDraftAction) => {
      dispatch(confirmDraft(draft.id));
    },
    [dispatch]
  );

  const handleDeclineDraft = useCallback(
    (draft: AgentDraftAction) => {
      dispatch(declineDraft(draft.id));
    },
    [dispatch]
  );

  const hasDrafts = drafts.length > 0;
  const hasToolCalls = toolCalls.length > 0;

  const helpMessage = useMemo(
    () =>
      'Ask about open work orders, inventory or request a draft action (for example "close my highest priority work order").',
    []
  );

  if (!enabled) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 16, md: 24 },
        right: { xs: 16, md: 24 },
        zIndex: (theme) => theme.zIndex.tooltip + 1
      }}
    >
      {!open ? (
        <Tooltip title="Open AI assistant">
          <Fab color="primary" onClick={handleToggle} aria-label="Chat assistant">
            <ForumIcon />
          </Fab>
        </Tooltip>
      ) : (
        <Paper
          elevation={12}
          sx={{
            width: { xs: 320, sm: 360 },
            height: 520,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Atlas Assistant
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {loadingDrafts && <CircularProgress size={16} />}
              <IconButton size="small" onClick={handleToggle}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2,
              py: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            {messages.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                {helpMessage}
              </Typography>
            )}
            {messages.map((message, index) => (
              <Box
                key={`${message.role}-${index}`}
                sx={{
                  display: 'flex',
                  justifyContent:
                    message.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    maxWidth: '85%',
                    borderRadius: 2,
                    bgcolor:
                      message.role === 'user'
                        ? (theme) => theme.palette.primary.main
                        : (theme) => theme.palette.grey[100],
                    color:
                      message.role === 'user'
                        ? 'primary.contrastText'
                        : 'text.primary'
                  }}
                >
                  <Typography variant="body2">{message.content}</Typography>
                </Box>
              </Box>
            ))}
            {sending && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Thinking...
                </Typography>
              </Box>
            )}
            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
          </Box>

          {hasToolCalls && (
            <>
              <Divider />
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="overline" color="text.secondary">
                  Tool activity
                </Typography>
                {toolCalls.slice(0, 3).map((call, index) => (
                  <ToolCallSummary
                    key={`${call.toolName}-${index}`}
                    label={call.toolName}
                    value={
                      call.status === 'success'
                        ? `${call.resultCount || 0} results`
                        : call.status || 'pending'
                    }
                  />
                ))}
              </Box>
            </>
          )}

          {hasDrafts && (
            <>
              <Divider />
              <DraftList
                drafts={drafts}
                onConfirm={handleConfirmDraft}
                onDecline={handleDeclineDraft}
              />
            </>
          )}

          <Divider />
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-end'
            }}
          >
            <TextField
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              fullWidth
              multiline
              minRows={1}
              maxRows={3}
              placeholder="Ask me about maintenance..."
              size="small"
            />
            <Button
              type="submit"
              variant="contained"
              disabled={sending || !prompt.trim()}
              endIcon={<SendIcon fontSize="small" />}
            >
              Send
            </Button>
          </Box>

          <Button
            variant="text"
            size="small"
            disabled={loadingDrafts}
            onClick={() => dispatch(loadDrafts())}
            sx={{ alignSelf: 'flex-start', ml: 2, mb: 1 }}
          >
            Refresh drafts
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default ChatDock;
