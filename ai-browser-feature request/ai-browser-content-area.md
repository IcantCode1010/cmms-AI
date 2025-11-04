# AI Browser Main Content Area - Frontend Specification

## Overview

The AI Browser main content area is a chat-based interface for intent-driven maintenance management. It features a conversational UI where users interact with an AI agent that can analyze maintenance issues, generate proposals, and link to work orders.

---

## Layout Structure

### Container

```plaintext
┌─────────────────────────────────────────┐
│ Header (56px fixed)                     │
├─────────────────────────────────────────┤
│                                         │
│ Messages Area (flex-1, scrollable)      │
│                                         │
├─────────────────────────────────────────┤
│ Input Area (auto height, min 100px)    │
└─────────────────────────────────────────┘
```

**Main Container:**

- Display: `flex flex-col`
- Height: `100%` (fills parent)
- Background: `bg-background`

---

## 1. Header Section

**Dimensions:** 56px height (h-14), full width

**Layout:**

```typescriptreact
<div className="flex h-14 items-center justify-between border-b border-border px-6">
  {/* Left: Title with icon */}
  {/* Right: Status badge */}
</div>
```

**Left Side:**

- Icon: Sparkles (20px, `text-primary`)
- Title: "AI Maintenance Assistant" (`font-semibold text-foreground`)
- Gap: 8px between icon and title

**Right Side:**

- Badge with green dot indicator
- Text: "Active Session"
- Dot: 8px circle, `bg-accent`

**Styling:**

- Border bottom: 1px solid `border-border`
- Padding: 24px horizontal

---

## 2. Messages Area (ScrollArea)

**Layout:**

- Flex: `flex-1` (takes remaining space)
- Padding: 24px horizontal, 24px vertical
- Spacing: 24px between messages (`space-y-6`)
- Scroll: Auto-scroll to bottom on new messages

### Empty State

**Centered content when no messages:**

```typescriptreact
<div className="flex flex-col items-center justify-center py-12 text-center">
  {/* Icon circle */}
  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
    <Sparkles className="h-8 w-8 text-primary" />
  </div>
  
  {/* Title */}
  <h3 className="mb-2 text-lg font-semibold text-foreground">
    Welcome to AI Maintenance Assistant
  </h3>
  
  {/* Description */}
  <p className="max-w-md text-sm text-muted-foreground">
    Describe your maintenance needs in natural language...
  </p>
  
  {/* Example buttons */}
  <div className="mt-6 grid gap-2">
    {/* 3 example buttons */}
  </div>
</div>
```

**Example Buttons:**

- Variant: `outline`
- Size: `sm`
- Pre-fill input on click

### Message Structure

**User Messages (Right-aligned):**

```typescriptreact
<div className="flex gap-3 justify-end">
  {/* Message bubble */}
  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-primary text-primary-foreground">
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  </div>
  
  {/* Avatar */}
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
    JD
  </div>
</div>
```

**Assistant Messages (Left-aligned):**

```typescriptreact
<div className="flex gap-3 justify-start">
  {/* Avatar */}
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
    <Sparkles className="h-4 w-4 text-primary-foreground" />
  </div>
  
  {/* Message bubble */}
  <div className="max-w-[80%] space-y-2 rounded-lg px-4 py-3 bg-muted text-foreground">
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  
    {/* Citations (if present) */}
    {citations && (
      <div className="space-y-1 border-t border-border/50 pt-2">
        {/* Citation items */}
      </div>
    )}
  </div>
</div>
```

**Message Styling:**

- Max width: 80% of container
- Border radius: `rounded-lg` (8px)
- Padding: 16px horizontal, 12px vertical
- Gap between avatar and bubble: 12px
- Line height: `leading-relaxed` (1.625)
- White space: `whitespace-pre-wrap` (preserves line breaks)

### Work Order Links

**Inline clickable links within messages:**

```typescriptreact
<button
  onClick={() => onWorkOrderClick?.(woId)}
  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary hover:bg-primary/20"
>
  {woId}
  <ExternalLink className="h-3 w-3" />
</button>
```

**Link Format in Content:**

- Pattern: `[WO-2024-001](wo://WO-2024-001)`
- Parsed and rendered as clickable buttons
- Font: Monospace (`font-mono`)
- Size: `text-xs`
- Background: `bg-primary/10` (hover: `bg-primary/20`)

### Citations

**Displayed below assistant messages:**

```typescriptreact
<div className="space-y-1 border-t border-border/50 pt-2">
  <p className="text-xs font-medium text-muted-foreground">Citations:</p>
  
  {citations.map(citation => (
    <div className="flex items-start gap-2 rounded border border-border/50 bg-background/50 p-2">
      <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
      <div className="flex-1 space-y-0.5">
        <p className="text-xs font-medium text-foreground">{citation.source}</p>
        <p className="text-xs text-muted-foreground">{citation.text}</p>
      </div>
    </div>
  ))}
</div>
```

**Citation Card:**

- Border: 1px solid `border-border/50`
- Background: `bg-background/50`
- Padding: 8px
- Border radius: `rounded` (4px)
- Icon: FileText (12px)
- Gap: 8px between icon and text

### Loading State

```typescriptreact
<div className="flex gap-3">
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
    <Sparkles className="h-4 w-4 text-primary-foreground" />
  </div>
  <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Analyzing your request...</span>
  </div>
</div>
```

---

## 3. Input Area

**Container:**

```typescriptreact
<div className="border-t border-border p-4">
  <form className="flex gap-2">
    {/* Textarea and Send button */}
  </form>
  <p className="mt-2 text-xs text-muted-foreground">
    Press Enter to send, Shift+Enter for new line
  </p>
</div>
```

**Textarea:**

- Min height: 60px
- Resize: none
- Placeholder: "Ask me anything about maintenance, work orders, or equipment..."
- Class: `min-h-[60px] resize-none`
- Keyboard: Enter to submit, Shift+Enter for new line

**Send Button:**

- Size: 60x60px (`h-[60px] w-[60px]`)
- Icon: Send (16px) or Loader2 when loading
- Disabled when: input empty or loading
- Type: `submit`

**Helper Text:**

- Margin top: 8px
- Size: `text-xs`
- Color: `text-muted-foreground`

---

## Color System

**Design Tokens (from globals.css):**

**Light Mode:**

- Background: `oklch(0.99 0 0)` - Near white
- Foreground: `oklch(0.15 0 0)` - Near black
- Primary: `oklch(0.45 0.15 265)` - Purple/blue
- Accent: `oklch(0.55 0.2 200)` - Cyan/blue
- Muted: `oklch(0.96 0.01 265)` - Light purple-gray
- Border: `oklch(0.9 0.01 265)` - Light gray

**Dark Mode:**

- Background: `oklch(0.1 0.01 265)` - Dark purple-black
- Foreground: `oklch(0.98 0.005 265)` - Near white
- Primary: `oklch(0.6 0.2 265)` - Bright purple
- Accent: `oklch(0.55 0.2 200)` - Bright cyan
- Muted: `oklch(0.2 0.02 265)` - Dark purple-gray
- Border: `oklch(0.2 0.02 265)` - Dark gray

---

## Typography

**Font Families:**

- Sans: Geist (default)
- Mono: Geist Mono (for work order IDs)

**Text Sizes:**

- Header title: `font-semibold` (16px)
- Message content: `text-sm leading-relaxed` (14px, line-height 1.625)
- Citations: `text-xs` (12px)
- Helper text: `text-xs` (12px)
- Work order links: `text-xs font-mono font-medium`

---

## Interactive Behaviors

### Message Submission

1. User types in textarea
2. Press Enter (not Shift+Enter) or click Send
3. Input clears immediately
4. User message appears instantly
5. Loading indicator shows (~800ms)
6. Assistant response appears with citations
7. Auto-scroll to bottom

### Work Order Linking

1. Agent response includes `[WO-ID](wo://WO-ID)` format
2. Parsed into clickable button
3. Click triggers `onWorkOrderClick(woId)` callback
4. Parent component handles navigation/modal

### Intent Detection

Agent analyzes input for:

- **View requests:** "show", "view", "list", "get", "find"
- **Troubleshooting:** "pack", "pressure", "fault", "symptom"
- **Create requests:** "create", "new", "add", "schedule"
- **Tail numbers:** Pattern `N\d{1,5}[A-Z]{1,3}`

### Response Types

**View Work Orders:**

- Lists clickable work order links
- Shows count and priority breakdown
- Offers filtering options

**Troubleshooting:**

- Analyzes symptoms
- Provides citations from manuals
- Generates proposal (appears in sidebar)

**General Maintenance:**

- Contextual recommendations
- Citations from asset database
- Optional proposal generation

---

## Data Types

```typescript
interface IntentMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  citations?: Citation[]
}

interface Citation {
  id: string
  source: string
  text: string
  url?: string
}
```

---

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation (Enter/Shift+Enter)
- Screen reader text for icons (`sr-only`)
- Focus states on all interactive elements
- Proper color contrast ratios

---

## Responsive Behavior

- Message max-width: 80% (prevents overly wide bubbles)
- Textarea auto-expands with content
- Scroll area adapts to container height
- Touch-friendly button sizes (60x60px minimum)
