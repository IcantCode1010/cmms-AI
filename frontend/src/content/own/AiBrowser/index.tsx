import { Helmet } from 'react-helmet-async';
import { AgentChatProvider } from 'src/contexts/AgentChatContext';
import ChatInterface from './ChatInterface';

/**
 * AI Browser page component.
 * Provides a full-page agent chat interface for maintenance tasks.
 */
const AiBrowserPage = () => (
  <>
    <Helmet title="AI Browser" />
    <AgentChatProvider>
      <ChatInterface />
    </AgentChatProvider>
  </>
);

export default AiBrowserPage;
