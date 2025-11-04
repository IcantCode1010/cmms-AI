# Agent Response Formatting Guide

**Version:** 1.0
**Last Updated:** 2025-10-17
**Component:** Atlas AI Agent Response System

---

## Overview

The Atlas AI Agent now supports **intelligent Markdown formatting** for all responses, providing rich, structured, and visually appealing output that enhances readability and user experience.

### Key Features

✅ **Markdown Rendering**: Full GitHub-flavored Markdown (GFM) support
✅ **Visual Indicators**: Emojis for status, priority, and entity types
✅ **Structured Output**: Headers, lists, tables, and blockquotes
✅ **Code Formatting**: Inline code and code blocks with syntax highlighting
✅ **Responsive Design**: Adapts to light/dark themes automatically

---

## Architecture

### Components

```
┌─────────────────────┐
│  Agent Instructions │  ← Markdown formatting rules
│  (agents-proxy)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Summary Functions   │  ← Rich Markdown output
│ (summariseWorkOrders)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Frontend Renderer  │  ← react-markdown + remark-gfm
│  (MarkdownMessage)  │
└─────────────────────┘
```

### File Locations

| Component | File Path |
|-----------|-----------|
| Agent Instructions | `agents-proxy/src/index.js:653-684` |
| Work Order Summary | `agents-proxy/src/index.js:313-352` |
| Asset Summary | `agents-proxy/src/index.js:354-386` |
| Markdown Renderer | `frontend/src/components/ChatDock/MarkdownMessage.tsx` |
| ChatDock Integration | `frontend/src/components/ChatDock/ChatDock.tsx:277-281` |

---

## Formatting Guidelines

### Agent Instructions

The agent follows these Markdown formatting requirements:

#### General Rules
- **Bold** (`**text**`) for work order codes, asset names, and identifiers
- Bullet lists (`-`) for multiple items
- Numbered lists (`1.`) for sequential steps or priorities
- Tables for structured data comparisons
- Blockquotes (`>`) for important warnings or notes
- Emojis for visual context and quick status recognition
- Headers (`###`) to group related information

#### Work Order Presentation
```markdown
### 📋 Work Orders (3)

- **WO-12345**: Replace pump bearings
  - Status: **OPEN** • Priority: 🔴 HIGH • Asset: **Pump-101** • Due: 10/20/2025

- **WO-12346**: Oil change
  - Status: **IN_PROGRESS** • Priority: 🟡 MEDIUM • Asset: **Compressor-5**

- **WO-12347**: Inspect valve
  - Status: **ON_HOLD** • Priority: 🟢 LOW • Asset: **Valve-22**
```

#### Asset Presentation
```markdown
### 🏭 Assets (2)

- **Pump-101**
  - Status: ✅ **OPERATIONAL** • Location: **Building A - Floor 2** • ID: `P-101`

- **Compressor-5**
  - Status: ⚠️ **DOWN** • Location: **Building B** • ID: `C-005`
```

---

## Emoji Reference

### Priority Indicators
| Priority | Emoji | Usage |
|----------|-------|-------|
| HIGH | 🔴 | Critical work orders requiring immediate attention |
| MEDIUM | 🟡 | Standard priority work orders |
| LOW | 🟢 | Non-urgent maintenance tasks |
| NONE | ⚪ | Unassigned priority |

### Status Indicators

**Work Order Status:**
- 📋 General work order indicator
- 📝 Generic task marker

**Asset Status:**
| Status | Emoji | Meaning |
|--------|-------|---------|
| OPERATIONAL | ✅ | Functioning normally |
| DOWN | ⚠️ | Not operational, requires attention |
| STANDBY | ⏸️ | Ready but not in use |
| MODERNIZATION | 🔧 | Under upgrade |
| INSPECTION_SCHEDULED | 🔍 | Scheduled for inspection |
| COMMISSIONING | 🚀 | Being brought online |
| EMERGENCY_SHUTDOWN | 🔴 | Emergency condition |

### Contextual Emojis
- ⚠️ Warnings or important notes
- ✅ Success or completion
- 📋 Lists or summaries
- 🔧 Maintenance activities
- 🏭 Assets or equipment
- 📦 Generic item/entity

---

## Frontend Implementation

### MarkdownMessage Component

**Location:** `frontend/src/components/ChatDock/MarkdownMessage.tsx`

**Dependencies:**
- `react-markdown`: ^10.1.0
- `remark-gfm`: ^4.0.1 (GitHub Flavored Markdown)

**Key Features:**
```typescript
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {content}
</ReactMarkdown>
```

### Styled Elements

The component provides styled rendering for:

| Element | Styling |
|---------|---------|
| Headers (h1-h6) | Bold, hierarchical sizing, proper spacing |
| Paragraphs | Comfortable line height, consistent spacing |
| Lists (ul/ol) | Proper indentation, nested list support |
| Code | Background highlight, monospace font, rounded corners |
| Code Blocks | Syntax-aware, scrollable, distinct background |
| Blockquotes | Left border accent, italic text, muted color |
| Tables | Bordered cells, header highlights, compact sizing |
| Links | Primary color, hover underline |
| Strong/Em | Bold and italic emphasis |

### Theme Support

All styles adapt to Material-UI theme mode:
- **Light mode**: Grey backgrounds, dark text
- **Dark mode**: Dark backgrounds, light text

---

## Example Outputs

### Example 1: Work Order List

**User Input:** "Show me open work orders"

**Agent Output:**
```markdown
Hi John, here's what I found:

### 📋 Work Orders (3)

- **WO-12345**: Replace pump bearings
  - Status: **OPEN** • Priority: 🔴 HIGH • Asset: **Pump-101** • Due: 10/20/2025

- **WO-12346**: Oil change
  - Status: **IN_PROGRESS** • Priority: 🟡 MEDIUM • Asset: **Compressor-5**

- **WO-12347**: Inspect valve
  - Status: **ON_HOLD** • Priority: 🟢 LOW • Asset: **Valve-22**

**Next steps:**
- Review the high priority work order for Pump-101
- Consider assigning resources to start the oil change
- Check the status of the valve inspection hold
```

### Example 2: Asset Search

**User Input:** "Find all compressors"

**Agent Output:**
```markdown
Hi Sarah, here are your compressors:

### 🏭 Assets (2)

- **Compressor-5**
  - Status: ⚠️ **DOWN** • Location: **Building B** • ID: `C-005`

- **Compressor-12**
  - Status: ✅ **OPERATIONAL** • Location: **Building A** • ID: `C-012`

> ⚠️ **Note:** Compressor-5 is currently down. Consider creating a work order for maintenance.
```

### Example 3: Completion Draft

**User Input:** "Complete work order 12345"

**Agent Output:**
```markdown
Hi Michael, I've prepared a completion draft for work order **WO-12345** (Replace pump bearings).

### 📝 Draft Details
- Work Order: **WO-12345**
- Title: Replace pump bearings
- Asset: **Pump-101**
- Priority: 🔴 HIGH

Please review and confirm this action in the **Pending actions** section below.
```

---

## Customization

### Adding New Emoji Mappings

**Work Order Priorities** (`agents-proxy/src/index.js:318-323`):
```javascript
const priorityEmoji = {
  HIGH: "🔴",
  MEDIUM: "🟡",
  LOW: "🟢",
  NONE: "⚪",
  // Add new priorities here
  URGENT: "🚨"
};
```

**Asset Statuses** (`agents-proxy/src/index.js:359-367`):
```javascript
const statusEmoji = {
  OPERATIONAL: "✅",
  DOWN: "⚠️",
  STANDBY: "⏸️",
  // Add new statuses here
  MAINTENANCE: "🔧"
};
```

### Modifying Agent Instructions

To change formatting behavior, edit `buildAgentInstructions()` in `agents-proxy/src/index.js:653-684`.

**Example: Add table formatting preference**
```javascript
"- Use tables for comparing 3+ items with multiple attributes",
"- Table format: | Column 1 | Column 2 | Column 3 |",
```

### Updating Frontend Styles

Modify `MarkdownWrapper` styles in `frontend/src/components/ChatDock/MarkdownMessage.tsx:7-96`.

**Example: Change code block background**
```typescript
'& pre': {
  backgroundColor: theme.palette.mode === 'dark'
    ? theme.palette.grey[900]  // ← Change this
    : theme.palette.grey[100],  // ← Change this
  // ... other styles
}
```

---

## Testing

### Manual Testing Checklist

Test the following scenarios:

**Basic Formatting:**
- [ ] Bold text renders correctly
- [ ] Bullet lists display properly
- [ ] Numbered lists increment correctly
- [ ] Headers show proper hierarchy
- [ ] Emojis display in all browsers

**Complex Formatting:**
- [ ] Nested lists indent properly
- [ ] Code blocks have correct syntax highlighting
- [ ] Tables align and border correctly
- [ ] Blockquotes show accent border
- [ ] Links are clickable and styled

**Theme Support:**
- [ ] Light mode displays with appropriate contrast
- [ ] Dark mode uses appropriate colors
- [ ] Theme switching doesn't break formatting

**Data Types:**
- [ ] Work orders show priority emojis
- [ ] Assets show status emojis
- [ ] Dates format correctly
- [ ] IDs render as inline code

### Example Test Prompts

```
1. "Show me open work orders"
   → Verify: List format, priority emojis, bold codes

2. "Find assets in Building A"
   → Verify: Asset header, status emojis, location display

3. "Show high priority work orders"
   → Verify: Filtering works, 🔴 emoji appears

4. "Complete work order 12345"
   → Verify: Draft section, proper formatting
```

---

## Performance Considerations

### Rendering Optimization

**Component Memoization:**
```typescript
const MarkdownMessage = memo(({ content }: MarkdownMessageProps) => {
  // Only re-renders when content changes
});
```

**Why it matters:**
- Chat messages don't change after creation
- Prevents unnecessary re-renders on typing or state updates
- Improves performance with long conversation histories

### Bundle Size

**Dependencies Added:**
- `react-markdown`: ~50KB (minified + gzipped)
- `remark-gfm`: ~15KB (minified + gzipped)

**Total impact:** ~65KB additional bundle size

---

## Troubleshooting

### Issue: Markdown Not Rendering

**Symptoms:** Raw markdown text appears (e.g., `**bold**` instead of **bold**)

**Solution:**
1. Verify `react-markdown` is installed: `npm list react-markdown`
2. Check component import in ChatDock.tsx: `import MarkdownMessage from './MarkdownMessage'`
3. Ensure conditional rendering: `{message.role === 'assistant' ? <MarkdownMessage .../> : ...}`

### Issue: Emojis Not Displaying

**Symptoms:** Empty squares or question marks instead of emojis

**Solution:**
1. Ensure UTF-8 encoding in response
2. Check browser emoji support (most modern browsers support)
3. Verify emoji characters aren't being escaped

### Issue: Styles Not Applied

**Symptoms:** Unstyled markdown (no colors, borders, spacing)

**Solution:**
1. Verify `MarkdownWrapper` styled component is used
2. Check Material-UI theme is properly provided
3. Inspect browser console for CSS errors

### Issue: Code Blocks Don't Scroll

**Symptoms:** Long code lines cause horizontal overflow

**Solution:**
1. Verify `overflowX: 'auto'` in `pre` styles
2. Check `maxWidth: '85%'` in message container
3. Test with longer code samples

---

## Future Enhancements

### Planned Features

1. **Syntax Highlighting**
   - Add `react-syntax-highlighter` for code blocks
   - Support multiple languages (JavaScript, Python, SQL, etc.)

2. **Interactive Elements**
   - Clickable work order codes (navigate to WO detail)
   - Clickable asset names (navigate to asset page)
   - Action buttons embedded in responses

3. **Rich Media**
   - Image support in responses
   - Embedded charts for analytics responses
   - File attachment previews

4. **Custom Components**
   - Work order cards with status badges
   - Asset status widgets
   - Progress indicators for long operations

5. **Copy/Export**
   - Copy formatted text to clipboard
   - Export conversation as Markdown file
   - Print-friendly formatting

### Implementation Priority

**Phase 1 (Current):** ✅ Basic Markdown rendering with emojis
**Phase 2:** Syntax highlighting for code blocks
**Phase 3:** Interactive clickable elements
**Phase 4:** Rich media and custom components
**Phase 5:** Export and sharing features

---

## Migration Notes

### From Plain Text to Markdown

**Backward Compatibility:**
- Old plain text messages still render correctly
- No database migration required
- Gradual rollout safe

**Breaking Changes:**
- None. Plain text is valid Markdown.

**Recommended Actions:**
1. Test with existing conversation history
2. Monitor for escaped characters (if any)
3. Verify emoji display across devices

---

## Support & Feedback

### Getting Help

**Documentation:**
- Agent Capabilities: `docs/AGENT_CAPABILITIES.md`
- Architecture Overview: `docs/agent-features.md`
- Technical Details: `docs/atlas-agents.md`

**Development Team:**
- Email: development-team@atlas-cmms.com
- Issue Tracker: GitHub Issues
- Discord: [Atlas CMMS Community](https://discord.gg/cHqyVRYpkA)

### Reporting Issues

When reporting formatting issues, include:
1. User prompt that triggered the response
2. Screenshot of the rendered output
3. Browser and version
4. Theme mode (light/dark)
5. Console errors (if any)

---

## Appendix

### Markdown Quick Reference

| Element | Syntax | Example |
|---------|--------|---------|
| Bold | `**text**` | **bold text** |
| Italic | `*text*` | *italic text* |
| Code | \`code\` | `inline code` |
| Header | `### Header` | ### Header |
| List | `- item` | - item |
| Numbered | `1. item` | 1. item |
| Link | `[text](url)` | [link](https://example.com) |
| Quote | `> text` | > quoted text |
| Table | `\| col \|` | \| Column \| |

### GFM Extensions

**Task Lists:**
```markdown
- [x] Completed task
- [ ] Incomplete task
```

**Strikethrough:**
```markdown
~~deleted text~~
```

**Tables:**
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

---

**Document Version:** 1.0
**Status:** Active
**Next Review:** After Phase 2 implementation
