# AI Browser Redesign: Agentic Chat UI Specification

## Executive Summary

This document specifies the redesign of the AI Browser feature to transform it from a complex intent-based workspace into a streamlined agentic chat UI that leverages existing agent infrastructure. The new design consolidates functionality from `ChatDock` and AI Browser into a unified, full-page chat experience.

**Design Date:** 2025-11-03
**Status:** Design Specification
**Target:** Frontend UI refactoring with existing backend integration

---

## 1. Current State Analysis

### 1.1 Existing Components

#### ChatDock (`frontend/src/components/ChatDock/`)
- **Location:** Fixed bottom-right floating dock
- **State:** `agentChat` Redux slice
- **Features:**
  - Agent message history with markdown rendering
  - Draft action confirmation UI
  - Tool call activity display
  - Session persistence (localStorage, 15min TTL)
  - Real-time message streaming

#### AI Browser (`frontend/src/content/own/AiBrowser/`)
- **Location:** Full-page route `/ai-browser`
- **State:** `aiBrowser` Redux slice
- **Features:**
  - Session/intent management
  - Proposal generation and tracking
  - Agent registry and switching
  - Citation management
  - Work order draft creation
  - Multi-agent orchestration concepts

### 1.2 Key Differences

| Feature | ChatDock | AI Browser |
|---------|----------|------------|
| UI Pattern | Floating dock | Full-page workspace |
| State Management | `agentChat` slice | `aiBrowser` slice |
| Backend Integration | ✅ Production agent API | ❌ Demo data only |
| Draft Actions | ✅ Full CRUD | ❌ Proposal-based only |
| Tool Calls | ✅ Real-time display | ❌ No visibility |
| Session Persistence | ✅ localStorage | ✅ sessionStorage |
| Message Rendering | ✅ Markdown with GFM | ✅ Markdown in bubbles |

### 1.3 Shared Infrastructure

Both features use:
- `AgentToolController.java` - Backend tool execution
- `agents-proxy` service - OpenAI Agents runtime
- Redux Toolkit for state management
- Material-UI components
- Markdown rendering with `react-markdown`

---

## 2. Design Goals

### 2.1 Primary Objectives

1. **Consolidate Functionality**: Merge ChatDock agent features into full-page AI Browser
2. **Leverage Existing Backend**: Use proven `agentChat` slice and real API integration
3. **Simplify Architecture**: Remove unused intent/proposal/orchestration concepts
4. **Maintain Feature Parity**: Preserve all working agent capabilities (drafts, tools, sessions)
5. **Improve UX**: Provide spacious, accessible chat interface for complex maintenance tasks

### 2.2 Non-Goals

- ❌ Backend API changes (use existing agent endpoints)
- ❌ New agent tools (focus on UI refactoring)
- ❌ Mobile app changes (frontend web only)
- ❌ Authentication/permissions changes

---

## 3. Architecture Design

### 3.1 State Management Strategy

**Decision:** Use `agentChat` slice as single source of truth

**Rationale:**
- ✅ Production-ready with real backend integration
- ✅ Session persistence and TTL management
- ✅ Draft action CRUD operations
- ✅ Tool call tracking
- ✅ Error handling and retry logic

**Migration Path:**
1. Keep `agentChat` slice unchanged
2. Deprecate `aiBrowser` slice entirely
3. Remove `SessionIntentContext` and related hooks
4. Update AI Browser page to connect to `agentChat`

### 3.2 Component Architecture

```
AiBrowserPage (route: /ai-browser)
├── AgentChatProvider (context wrapper)
│   └── ChatInterface (main container)
│       ├── ChatHeader (session info, refresh, clear)
│       ├── MessageList (scrollable conversation)
│       │   ├── MessageBubble (user/assistant with markdown)
│       │   ├── ToolCallActivity (inline tool execution status)
│       │   └── LoadingIndicator (agent thinking state)
│       ├── DraftActionPanel (confirmation UI, collapsible)
│       └── MessageInput (composer with submit)
```

### 3.3 Layout Specifications

#### Desktop (≥1280px)
```
┌─────────────────────────────────────────────────┐
│ Chat Header (session, controls)          60px  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Message List (scrollable)              flex-1  │
│   • User messages (right-aligned)               │
│   • Assistant messages (left-aligned, markdown) │
│   • Tool call activity (inline badges)          │
│                                                 │
├─────────────────────────────────────────────────┤
│ Draft Action Panel (when active)         auto  │
├─────────────────────────────────────────────────┤
│ Message Input (composer)                120px  │
└─────────────────────────────────────────────────┘
```

#### Mobile (<768px)
- Full-screen layout
- Collapsible header
- Sticky message input
- Bottom-sheet for draft actions

---

## 4. Component Specifications

### 4.1 ChatInterface (Main Container)

**File:** `frontend/src/content/own/AiBrowser/ChatInterface.tsx`

**Responsibilities:**
- Connect to `agentChat` Redux slice
- Handle message submission
- Manage draft action lifecycle
- Auto-scroll to latest message

**Props:**
```typescript
interface ChatInterfaceProps {
  // No props - self-contained with Redux
}
```

**State Connections:**
```typescript
const {
  messages,
  drafts,
  toolCalls,
  sending,
  error,
  sessionId
} = useSelector(selectAgentChat);

const dispatch = useDispatch();
```

**Key Behaviors:**
- Auto-refresh drafts when chat opens
- Persist session to localStorage
- Clear error state on new message
- Scroll to bottom on message updates

### 4.2 ChatHeader

**File:** `frontend/src/content/own/AiBrowser/components/ChatHeader.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Atlas Assistant                [Clear] [Refresh]│
│ Session: abc-123                                │
└─────────────────────────────────────────────────┘
```

**Actions:**
- **Clear Chat**: Dispatch `clearMessages()` and reset localStorage
- **Refresh Drafts**: Dispatch `loadDrafts()`
- **Session Display**: Show current `sessionId` or "New Session"

### 4.3 MessageList

**File:** `frontend/src/content/own/AiBrowser/components/MessageList.tsx`

**Responsibilities:**
- Render message bubbles (user/assistant)
- Display tool call activity inline
- Show loading indicator when `sending === true`
- Auto-scroll to latest message

**Message Rendering:**
```typescript
{messages.map((message, index) => (
  <MessageBubble
    key={`${message.role}-${index}`}
    message={message}
    isUser={message.role === 'user'}
  />
))}
```

**Tool Call Display:**
```typescript
{toolCalls.length > 0 && (
  <ToolCallActivity calls={toolCalls.slice(-5)} />
)}
```

### 4.4 MessageBubble

**File:** `frontend/src/content/own/AiBrowser/components/MessageBubble.tsx`

**Props:**
```typescript
interface MessageBubbleProps {
  message: AgentChatMessage;
  isUser: boolean;
}
```

**Styling:**
- **User messages**: Right-aligned, primary color background, white text
- **Assistant messages**: Left-aligned, grey background, dark text with markdown rendering

**Markdown Integration:**
```typescript
{isUser ? (
  <Typography variant="body2">{message.content}</Typography>
) : (
  <MarkdownMessage content={message.content} />
)}
```

### 4.5 DraftActionPanel

**File:** `frontend/src/content/own/AiBrowser/components/DraftActionPanel.tsx`

**Props:**
```typescript
interface DraftActionPanelProps {
  drafts: AgentDraftAction[];
  onConfirm: (draftId: number) => void;
  onDecline: (draftId: number) => void;
  loading: boolean;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Pending Actions (2)                             │
├─────────────────────────────────────────────────┤
│ Close work order WO-123                         │
│ [Confirm] [Decline]                             │
├─────────────────────────────────────────────────┤
│ Update asset status to "Operational"            │
│ [Confirm] [Decline]                             │
└─────────────────────────────────────────────────┘
```

**Behaviors:**
- Show when `drafts.length > 0`
- Collapsible header with count badge
- Confirm → `dispatch(confirmDraft(id))`
- Decline → `dispatch(declineDraft(id))`

### 4.6 MessageInput

**File:** `frontend/src/content/own/AiBrowser/components/MessageInput.tsx`

**Props:**
```typescript
interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}
```

**Features:**
- Multiline text input (1-4 rows auto-expand)
- Send button (disabled when empty or sending)
- Enter key submits (Shift+Enter for new line)
- Clear input on successful submission

### 4.7 ToolCallActivity

**File:** `frontend/src/content/own/AiBrowser/components/ToolCallActivity.tsx`

**Props:**
```typescript
interface ToolCallActivityProps {
  calls: AgentToolCall[];
}
```

**Layout:**
```
Tool Activity:
• view_work_orders → 5 results ✓
• view_assets → 12 results ✓
• create_work_order_draft → pending ⏳
```

**Status Icons:**
- ✓ Success (green)
- ⏳ Pending (blue)
- ✗ Error (red)

---

## 5. Components to Remove

### 5.1 Deprecated Components

**Remove entirely:**
1. `frontend/src/content/own/AiBrowser/IntentWorkspace.tsx`
2. `frontend/src/content/own/AiBrowser/components/SessionListPanel.tsx`
3. `frontend/src/content/own/AiBrowser/components/ProposalSidebar.tsx`
4. `frontend/src/content/own/AiBrowser/components/CreateWorkOrderModal.tsx`
5. `frontend/src/content/own/AiBrowser/components/CitationList.tsx`
6. `frontend/src/content/own/AiBrowser/components/WelcomeState.tsx`
7. `frontend/src/content/own/AiBrowser/components/LoadingMessage.tsx`
8. `frontend/src/content/own/AiBrowser/components/layout/SessionHeader.tsx`
9. `frontend/src/content/own/AiBrowser/components/layout/ConversationPane.tsx`
10. `frontend/src/content/own/AiBrowser/components/layout/MessageComposer.tsx`

**Rationale:**
- Intent/session/proposal concepts not used
- Citation tracking not implemented in backend
- Welcome state replaced with simple empty chat
- Existing `MarkdownMessage` component handles rendering

### 5.2 Deprecated State

**Remove from codebase:**
1. `frontend/src/slices/aiBrowser.ts` - Entire slice
2. `frontend/src/contexts/SessionIntentContext.tsx` - Context wrapper
3. `frontend/src/hooks/useIntentActions.ts` - Intent-specific hook
4. `frontend/src/hooks/useProposalActions.ts` - Proposal-specific hook
5. `frontend/src/types/aiBrowser.ts` - Intent/proposal types

**Keep:**
- `frontend/src/slices/agentChat.ts` ✅
- `frontend/src/types/agentChat.ts` ✅
- `frontend/src/utils/agentApi.ts` ✅

### 5.3 Deprecated Hooks

**Remove:**
1. `useSessionIntent()` → Replace with `useSelector(selectAgentChat)`
2. `useIntentActions()` → Replace with `useAgentChat()` custom hook
3. `useProposalActions()` → Not needed (draft actions replace proposals)
4. `useAgentRegistry()` → Remove (single agent mode)

---

## 6. New Component Specifications

### 6.1 useAgentChat Hook

**File:** `frontend/src/hooks/useAgentChat.ts`

**Purpose:** Encapsulate agent chat Redux operations

```typescript
export function useAgentChat() {
  const dispatch = useDispatch();
  const chat = useSelector(selectAgentChat);

  const sendMessage = useCallback((prompt: string) => {
    dispatch(sendPrompt(prompt));
  }, [dispatch]);

  const confirmDraft = useCallback((draftId: number) => {
    dispatch(confirmDraft(draftId));
  }, [dispatch]);

  const declineDraft = useCallback((draftId: number) => {
    dispatch(declineDraft(draftId));
  }, [dispatch]);

  const refreshDrafts = useCallback(() => {
    dispatch(loadDrafts());
  }, [dispatch]);

  const toggleChat = useCallback((open: boolean) => {
    dispatch(toggleDock(open));
  }, [dispatch]);

  return {
    ...chat,
    sendMessage,
    confirmDraft,
    declineDraft,
    refreshDrafts,
    toggleChat
  };
}
```

### 6.2 AgentChatProvider Context

**File:** `frontend/src/contexts/AgentChatContext.tsx`

**Purpose:** Provide agent chat state without complex intent logic

```typescript
interface AgentChatContextValue {
  messages: AgentChatMessage[];
  drafts: AgentDraftAction[];
  toolCalls: AgentToolCall[];
  sending: boolean;
  error?: string;
  sessionId?: string;
  sendMessage: (prompt: string) => void;
  confirmDraft: (draftId: number) => void;
  declineDraft: (draftId: number) => void;
  refreshDrafts: () => void;
  clearChat: () => void;
}
```

---

## 7. Migration Strategy

### 7.1 Phase 1: New Component Development

**Tasks:**
1. Create `ChatInterface.tsx` with Redux integration
2. Create `ChatHeader.tsx` with actions
3. Create `MessageList.tsx` with message rendering
4. Create `MessageBubble.tsx` (reuse ChatDock styling)
5. Create `DraftActionPanel.tsx` (reuse ChatDock DraftList)
6. Create `MessageInput.tsx` (reuse ChatDock input)
7. Create `ToolCallActivity.tsx` (reuse ChatDock ToolCallSummary)
8. Create `useAgentChat.ts` hook
9. Create `AgentChatContext.tsx` provider

**Deliverable:** New component library ready for integration

### 7.2 Phase 2: Integration

**Tasks:**
1. Update `frontend/src/content/own/AiBrowser/index.tsx`:
   ```typescript
   import ChatInterface from './ChatInterface';

   const AiBrowserPage = () => (
     <>
       <Helmet title="AI Browser" />
       <AgentChatProvider>
         <ChatInterface />
       </AgentChatProvider>
     </>
   );
   ```

2. Update route permissions (already in place)
3. Test agent chat functionality in full-page context

**Deliverable:** Functional AI Browser with agent chat

### 7.3 Phase 3: Cleanup

**Tasks:**
1. Remove deprecated components (listed in section 5.1)
2. Remove deprecated state slices (listed in section 5.2)
3. Remove deprecated hooks (listed in section 5.3)
4. Remove unused types from `frontend/src/types/aiBrowser.ts`
5. Update imports across codebase
6. Run linter and fix warnings
7. Update tests if any exist

**Deliverable:** Clean codebase with no unused code

### 7.4 Phase 4: Enhancement (Optional)

**Future improvements:**
- Session history sidebar (switch between past conversations)
- Export chat transcript
- Dark mode optimization
- Keyboard shortcuts (Ctrl+K to focus input)
- Message reactions/feedback
- Code syntax highlighting in markdown

---

## 8. API Integration

### 8.1 Existing Endpoints (No Changes)

**Agent Chat:**
- `POST /api/agent/chat` - Send message, get response
- `GET /api/agent/drafts` - List pending drafts
- `POST /api/agent/drafts/{id}/confirm` - Confirm draft
- `POST /api/agent/drafts/{id}/decline` - Decline draft

**Already integrated in:**
- `frontend/src/utils/agentApi.ts`
- `frontend/src/slices/agentChat.ts`

### 8.2 State Persistence

**localStorage (existing):**
```typescript
{
  "atlas-agent-chat-state": {
    "sessionId": "uuid-v4",
    "messages": [...],
    "updatedAt": 1730678400000
  }
}
```

**TTL:** 15 minutes (configurable via `REACT_APP_AGENT_MEMORY_TTL_MS`)

---

## 9. Accessibility Requirements

### 9.1 ARIA Attributes

**ChatInterface:**
```html
<div role="region" aria-label="AI Assistant Chat" aria-live="polite">
```

**MessageList:**
```html
<div role="log" aria-live="polite" aria-atomic="false">
```

**MessageInput:**
```html
<textarea
  aria-label="Message input"
  aria-describedby="send-button-help"
/>
```

### 9.2 Keyboard Navigation

- **Tab**: Navigate between input, send button, draft actions
- **Enter**: Submit message (when input focused)
- **Shift+Enter**: New line in input
- **Escape**: Clear input draft
- **Ctrl+K**: Focus message input (global shortcut)

### 9.3 Screen Reader Support

- Announce new messages via `aria-live="polite"`
- Announce draft actions via `role="alert"`
- Label all interactive elements
- Provide skip links for navigation

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Components to test:**
1. `ChatInterface` - Redux integration, message submission
2. `MessageBubble` - Rendering user/assistant messages
3. `DraftActionPanel` - Confirm/decline actions
4. `MessageInput` - Input handling, validation
5. `useAgentChat` - Hook logic and Redux dispatch

**Framework:** Jest + React Testing Library

### 10.2 Integration Tests

**Scenarios:**
1. Send message → receive assistant response
2. Trigger draft action → confirm → verify API call
3. View tool calls → verify status display
4. Session persistence → reload page → verify messages restored
5. Error handling → verify error message display

### 10.3 Manual Testing Checklist

- [ ] Send basic maintenance question
- [ ] Verify markdown rendering (lists, bold, code)
- [ ] Confirm draft action
- [ ] Decline draft action
- [ ] View tool call activity
- [ ] Test on mobile viewport
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Verify session persistence across refresh
- [ ] Test error states (network failure)

---

## 11. Performance Considerations

### 11.1 Optimization Strategies

**Message List:**
- Use `React.memo()` for `MessageBubble` components
- Virtualize message list if >100 messages (react-window)
- Lazy load old messages from localStorage

**Markdown Rendering:**
- Memoize `MarkdownMessage` component
- Use lightweight markdown parser (remark-gfm already in use)

**State Updates:**
- Batch Redux updates for message + tool calls
- Debounce draft refresh (avoid excessive polling)

### 11.2 Bundle Size Impact

**Removed:**
- ~15KB: Intent/proposal/orchestration logic
- ~8KB: SessionIntentContext and related hooks
- ~12KB: Deprecated components (ProposalSidebar, etc.)

**Added:**
- ~5KB: New ChatInterface components (reusing existing)
- ~2KB: useAgentChat hook

**Net Change:** ~28KB reduction in bundle size

---

## 12. Security Considerations

### 12.1 Input Validation

**Message Input:**
- Trim whitespace before submission
- Sanitize markdown in assistant responses (already handled by `react-markdown`)
- Prevent XSS via markdown injection

**Draft Actions:**
- Validate draft IDs are numbers
- Verify user permissions before confirm/decline (backend enforces)

### 12.2 Session Management

**Session Hijacking Prevention:**
- Session IDs generated server-side (UUID v4)
- JWT token required for all API calls
- localStorage TTL prevents stale session reuse

### 12.3 Data Privacy

**PII Handling:**
- Do not log message content to console
- Clear localStorage on logout
- Respect GDPR data retention policies (15min TTL)

---

## 13. Rollout Plan

### 13.1 Development Timeline

**Week 1:**
- Day 1-2: Create new components (ChatInterface, MessageList, etc.)
- Day 3: Create useAgentChat hook and AgentChatProvider
- Day 4-5: Integration testing and bug fixes

**Week 2:**
- Day 1-2: Remove deprecated components and state
- Day 3: Cleanup and linter fixes
- Day 4: Manual testing and accessibility audit
- Day 5: Code review and final polish

### 13.2 Deployment Strategy

**Staged Rollout:**
1. **Internal Testing**: Deploy to staging environment, test with team
2. **Beta Release**: Enable for admin users only via feature flag
3. **Gradual Rollout**: Enable for 10%, 50%, 100% of users
4. **Monitor Metrics**: Error rates, API latency, user engagement

**Feature Flag:**
```typescript
const AI_BROWSER_V2_ENABLED = process.env.REACT_APP_AI_BROWSER_V2 === 'true';
```

### 13.3 Rollback Plan

**If critical issues detected:**
1. Disable feature flag → revert to old UI
2. Preserve user session data (backward compatible)
3. Fix issues in separate branch
4. Re-deploy after validation

---

## 14. Success Metrics

### 14.1 Technical Metrics

- **Bundle Size**: Reduce by ≥20KB
- **Component Count**: Reduce from 15 → 8 components
- **State Complexity**: Single slice (agentChat) vs dual (agentChat + aiBrowser)
- **Test Coverage**: Maintain ≥80% coverage

### 14.2 User Experience Metrics

- **Message Success Rate**: ≥95% successful agent responses
- **Draft Confirmation Time**: <30 seconds from proposal to action
- **Session Persistence**: ≥90% sessions restored after refresh
- **Error Rate**: <2% failed agent calls

### 14.3 Performance Metrics

- **Initial Load Time**: <2 seconds to interactive
- **Message Render Time**: <100ms per message
- **Tool Call Display Latency**: <50ms after API response

---

## 15. Documentation Updates

### 15.1 Developer Documentation

**Update files:**
1. `CLAUDE.md` - Update AI Browser section with new architecture
2. `frontend/README.md` - Add agent chat component guide
3. `docs/AGENT_CAPABILITIES.md` - Reference new UI patterns

### 15.2 User Documentation

**Create guides:**
1. "Using the AI Assistant" - Basic chat features
2. "Understanding Draft Actions" - Confirm/decline workflow
3. "Tool Activity Explained" - What agents are doing behind the scenes

### 15.3 Code Comments

**Inline documentation:**
- JSDoc comments for all public functions
- Component prop descriptions
- Redux action documentation
- Hook usage examples

---

## 16. Open Questions

1. **Session History**: Should users be able to view past chat sessions? (Future enhancement)
2. **Multi-Agent Support**: Should UI support switching between different agent types? (Current: single agent)
3. **Export Functionality**: Should users export chat transcripts? (Future enhancement)
4. **Notification Strategy**: How to notify users of new draft actions when chat is closed? (Keep floating dock for notifications?)

---

## 17. Design Decisions Log

### Decision 1: Use agentChat slice over aiBrowser slice
- **Rationale**: Production-ready, real backend integration, proven reliability
- **Trade-offs**: Lose intent/proposal concepts (not needed for current use case)
- **Alternatives Considered**: Merge both slices (rejected due to complexity)

### Decision 2: Full-page UI instead of floating dock
- **Rationale**: AI Browser route already exists, more space for complex interactions
- **Trade-offs**: Less convenient for quick questions (consider keeping dock for notifications)
- **Alternatives Considered**: Expandable dock (rejected for simplicity)

### Decision 3: Remove all intent/proposal/orchestration concepts
- **Rationale**: Not implemented in backend, adds complexity without value
- **Trade-offs**: Potential future feature (can re-add if needed)
- **Alternatives Considered**: Keep for future (rejected to reduce maintenance burden)

### Decision 4: Reuse ChatDock components where possible
- **Rationale**: Proven UI patterns, consistent UX, faster development
- **Trade-offs**: Some styling adjustments needed for full-page context
- **Alternatives Considered**: Build from scratch (rejected for efficiency)

---

## 18. Appendix

### A. Component File Structure

```
frontend/src/content/own/AiBrowser/
├── index.tsx                          # Route entry point
├── ChatInterface.tsx                  # Main container
├── components/
│   ├── ChatHeader.tsx                 # Session info, actions
│   ├── MessageList.tsx                # Scrollable conversation
│   ├── MessageBubble.tsx              # Individual message (user/assistant)
│   ├── DraftActionPanel.tsx           # Draft confirmation UI
│   ├── MessageInput.tsx               # Text input + send button
│   └── ToolCallActivity.tsx           # Tool execution status
├── hooks/
│   └── useAgentChat.ts                # Redux integration hook
└── contexts/
    └── AgentChatContext.tsx           # Context provider (optional)
```

### B. Redux State Schema

```typescript
// agentChat slice
{
  enabled: boolean;
  open: boolean;          // Not used in full-page context
  sending: boolean;
  loadingDrafts: boolean;
  messages: AgentChatMessage[];
  drafts: AgentDraftAction[];
  toolCalls: AgentToolCall[];
  error?: string;
  agentId?: string;
  sessionId?: string;
  correlationId?: string;
}
```

### C. API Request/Response Examples

**Send Message:**
```typescript
// Request
POST /api/agent/chat
{
  prompt: "Show me high priority work orders",
  agentId: "atlas-maintenance-copilot",
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  metadata: { source: "web" }
}

// Response
{
  status: "success",
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  messages: [
    { role: "assistant", content: "I found 5 high priority work orders..." }
  ],
  drafts: [],
  toolCalls: [
    { toolName: "view_work_orders", status: "success", resultCount: 5 }
  ]
}
```

**Confirm Draft:**
```typescript
// Request
POST /api/agent/drafts/123/confirm

// Response
{
  id: 123,
  status: "confirmed",
  result: { workOrderId: 456 }
}
```

### D. Migration Checklist

**Phase 1: Development**
- [ ] Create ChatInterface component
- [ ] Create ChatHeader component
- [ ] Create MessageList component
- [ ] Create MessageBubble component
- [ ] Create DraftActionPanel component
- [ ] Create MessageInput component
- [ ] Create ToolCallActivity component
- [ ] Create useAgentChat hook
- [ ] Create AgentChatContext provider

**Phase 2: Integration**
- [ ] Update AiBrowserPage route
- [ ] Test message sending
- [ ] Test draft actions
- [ ] Test tool call display
- [ ] Test session persistence
- [ ] Verify mobile responsiveness

**Phase 3: Cleanup**
- [ ] Remove IntentWorkspace and related components
- [ ] Remove aiBrowser slice
- [ ] Remove SessionIntentContext
- [ ] Remove intent/proposal hooks
- [ ] Remove unused types
- [ ] Run linter and fix warnings
- [ ] Update tests

**Phase 4: Documentation**
- [ ] Update CLAUDE.md
- [ ] Update component documentation
- [ ] Add user guide
- [ ] Add code comments

---

## 19. Conclusion

This redesign simplifies the AI Browser by leveraging proven agent chat infrastructure while providing a spacious, accessible full-page interface. By removing unused intent/proposal concepts and consolidating on the `agentChat` state slice, we reduce complexity and improve maintainability.

The phased migration strategy ensures minimal disruption while delivering incremental value. The design preserves all existing agent capabilities (draft actions, tool calls, session persistence) while improving the user experience for complex maintenance workflows.

**Next Steps:**
1. Review and approve this specification
2. Begin Phase 1 development (new components)
3. Conduct integration testing in staging environment
4. Plan gradual rollout with feature flag

**Questions or Feedback:**
- Submit via GitHub issues or team chat
- Contact: Development team
