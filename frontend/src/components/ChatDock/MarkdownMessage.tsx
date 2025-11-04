import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Button, styled } from '@mui/material';

// Styled wrapper for markdown content
const MarkdownWrapper = styled(Box)(({ theme }) => ({
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
    lineHeight: 1.3
  },
  '& h3': {
    fontSize: '1rem',
    color: theme.palette.text.primary
  },
  '& p': {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    lineHeight: 1.6
  },
  '& ul, & ol': {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(2.5)
  },
  '& li': {
    marginTop: theme.spacing(0.25),
    marginBottom: theme.spacing(0.25),
    lineHeight: 1.5
  },
  '& li > ul, & li > ol': {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5)
  },
  '& code': {
    backgroundColor: theme.palette.mode === 'dark'
      ? theme.palette.grey[800]
      : theme.palette.grey[200],
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.875em',
    fontFamily: 'monospace'
  },
  '& pre': {
    backgroundColor: theme.palette.mode === 'dark'
      ? theme.palette.grey[900]
      : theme.palette.grey[100],
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    overflowX: 'auto',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  '& pre code': {
    backgroundColor: 'transparent',
    padding: 0
  },
  '& blockquote': {
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    marginLeft: 0,
    marginRight: 0,
    paddingLeft: theme.spacing(1.5),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontStyle: 'italic'
  },
  '& table': {
    borderCollapse: 'collapse',
    width: '100%',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    fontSize: '0.875rem'
  },
  '& th, & td': {
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.75, 1),
    textAlign: 'left'
  },
  '& th': {
    backgroundColor: theme.palette.mode === 'dark'
      ? theme.palette.grey[800]
      : theme.palette.grey[100],
    fontWeight: 600
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  },
  '& hr': {
    border: 'none',
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5)
  },
  '& strong': {
    fontWeight: 600
  },
  '& em': {
    fontStyle: 'italic'
  }
}));

interface MarkdownMessageProps {
  content: string;
  onWorkOrderLink?: (workOrderId: string) => void;
}

const MarkdownMessage = memo(({ content, onWorkOrderLink }: MarkdownMessageProps) => {
  return (
    <MarkdownWrapper>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('wo://') && onWorkOrderLink) {
              const workOrderId = href.replace('wo://', '');
              return (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onWorkOrderLink(workOrderId)}
                  sx={{
                    fontFamily: 'Geist Mono, monospace',
                    textTransform: 'none',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(85,105,255,0.12)',
                    '&:hover': { backgroundColor: 'rgba(85,105,255,0.2)' }
                  }}
                >
                  {children}
                </Button>
              );
            }

            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </MarkdownWrapper>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';

export default MarkdownMessage;
