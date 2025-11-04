# AI Browser Main Content Area - Technical Design Specification

## Architecture Overview

The AI browser main content area is a **three-section flexbox layout** that fills 100% of its parent container height:

```plaintext
┌─────────────────────────────────────┐
│ Header (fixed 56px)                 │  ← flex: none
├─────────────────────────────────────┤
│                                     │
│ Messages Area (flex-1, scrollable)  │  ← flex: 1 (grows)
│                                     │
├─────────────────────────────────────┤
│ Input Area (auto height)            │  ← flex: none
└─────────────────────────────────────┘
```

**Container:** `flex flex-col h-full`

---

## 1. Header Section Design

**Structure:** Fixed height bar with left-aligned title and right-aligned status badge

**Layout:**

- Height: `h-14` (56px fixed)
- Display: `flex items-center justify-between`
- Border: `border-b border-border` (1px solid, uses design token)
- Padding: `px-6` (24px horizontal)

**Left Side:**

- Sparkles icon: `h-5 w-5 text-primary` (20px, purple/blue)
- Title: "AI Maintenance Assistant" with `font-semibold text-foreground`
- Gap: `gap-2` (8px between icon and text)

**Right Side:**

- Badge component with `variant="secondary"`
- Green dot indicator: `h-2 w-2 rounded-full bg-accent` (8px circle)
- Text: "Active Session"

**Color Tokens Used:**

- `text-primary`: oklch(0.45 0.15 265) - purple/blue
- `text-foreground`: oklch(0.15 0 0) - near black
- `bg-accent`: oklch(0.55 0.2 200) - cyan/blue
- `border-border`: oklch(0.9 0.01 265) - light gray

---

## 2. Messages Area Design

**Structure:** Scrollable container with auto-scroll to bottom on new messages

**Layout:**

- Flex: `flex-1` (takes all remaining vertical space)
- Component: `ScrollArea` from shadcn/ui
- Padding: `px-6` (24px horizontal)
- Inner spacing: `space-y-6 py-6` (24px between messages, 24px top/bottom)

### Empty State

**Centered welcome screen when no messages exist:**

```typescriptreact
<div className="flex flex-col items-center justify-center py-12 text-center">
  {/* Icon circle: 64x64px with 10% opacity primary background */}
  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
    <Sparkles className="h-8 w-8 text-primary" />
  </div>
  
  {/* Title: large semibold */}
  <h3 className="mb-2 text-lg font-semibold text-foreground">
    Welcome to AI Maintenance Assistant
  </h3>
  
  {/* Description: small muted text, max 448px wide */}
  <p className="max-w-md text-sm text-muted-foreground">
    Describe your maintenance needs...
  </p>
  
  {/* Example buttons: 3 outline buttons in vertical stack */}
  <div className="mt-6 grid gap-2">
    <Button variant="outline" size="sm">Example: HVAC issue</Button>
    <Button variant="outline" size="sm">Example: Aircraft troubleshooting</Button>
    <Button variant="outline" size="sm">Example: View work orders</Button>
  </div>
</div>
```

### Message Bubbles

**User Messages (right-aligned):**

```typescriptreact
<div className="flex gap-3 justify-end">
  {/* Message bubble */}
  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-primary text-primary-foreground">
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  </div>
  
  {/* Avatar: 32x32px circle with initials */}
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
    JD
  </div>
</div>
```

**Assistant Messages (left-aligned):**

```typescriptreact
<div className="flex gap-3 justify-start">
  {/* Avatar: 32x32px circle with Sparkles icon */}
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
    <Sparkles className="h-4 w-4 text-primary-foreground" />
  </div>
  
  {/* Message bubble with citations */}
  <div className="max-w-[80%] space-y-2 rounded-lg px-4 py-3 bg-muted text-foreground">
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  
    {/* Citations section (if present) */}
    <div className="space-y-1 border-t border-border/50 pt-2">
      <p className="text-xs font-medium text-muted-foreground">Citations:</p>
      {/* Citation cards */}
    </div>
  </div>
</div>
```

**Message Bubble Styling:**

- Max width: `max-w-[80%]` (80% of container)
- Border radius: `rounded-lg` (8px)
- Padding: `px-4 py-3` (16px horizontal, 12px vertical)
- Gap between avatar and bubble: `gap-3` (12px)
- Text: `text-sm leading-relaxed` (14px, line-height 1.625)
- White space: `whitespace-pre-wrap` (preserves line breaks)

**User bubble colors:**

- Background: `bg-primary` (purple/blue)
- Text: `text-primary-foreground` (near white)

**Assistant bubble colors:**

- Background: `bg-muted` (light purple-gray)
- Text: `text-foreground` (near black)

### Work Order Links

**Inline clickable buttons within message content:**

The system parses markdown-style links `[WO-2024-001](wo://WO-2024-001)` and renders them as:

```typescriptreact
<button
  onClick={() => onWorkOrderClick?.(woId)}
  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary hover:bg-primary/20"
>
  WO-2024-001
  <ExternalLink className="h-3 w-3" />
</button>
```

**Link styling:**

- Font: `font-mono` (Geist Mono)
- Size: `text-xs` (12px)
- Background: `bg-primary/10` (10% opacity primary)
- Hover: `hover:bg-primary/20` (20% opacity primary)
- Padding: `px-2 py-0.5` (8px horizontal, 2px vertical)
- Icon: ExternalLink at 12px

### Citations

**Displayed below assistant messages with border separator:**

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

**Citation card styling:**

- Border: `border border-border/50` (1px solid, 50% opacity)
- Background: `bg-background/50` (50% opacity background)
- Padding: `p-2` (8px all sides)
- Border radius: `rounded` (4px)
- Icon: FileText at 12px
- Gap: `gap-2` (8px between icon and text)

### Loading State

**Animated loading indicator:**

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

## 3. Input Area Design

**Structure:** Fixed bottom section with textarea and send button

**Layout:**

- Border: `border-t border-border` (1px solid top border)
- Padding: `p-4` (16px all sides)
- Form: `flex gap-2` (8px gap between textarea and button)

**Textarea:**

- Min height: `min-h-[60px]` (60px minimum)
- Resize: `resize-none` (disabled)
- Placeholder: "Ask me anything about maintenance, work orders, or equipment..."
- Keyboard: Enter submits, Shift+Enter adds new line

**Send Button:**

- Size: `h-[60px] w-[60px]` (60x60px square)
- Type: `icon` button
- Icon: Send (16px) or Loader2 when loading
- Disabled when: input empty or loading
- Shows spinning loader during submission

**Helper Text:**

- Margin: `mt-2` (8px top)
- Size: `text-xs` (12px)
- Color: `text-muted-foreground`
- Content: "Press Enter to send, Shift+Enter for new line"

---

## Color System

**Design tokens from globals.css:**

### Light Mode

- Background: `oklch(0.99 0 0)` - Near white
- Foreground: `oklch(0.15 0 0)` - Near black
- Primary: `oklch(0.45 0.15 265)` - Purple/blue
- Accent: `oklch(0.55 0.2 200)` - Cyan/blue
- Muted: `oklch(0.96 0.01 265)` - Light purple-gray
- Muted-foreground: `oklch(0.5 0.02 265)` - Medium gray
- Border: `oklch(0.9 0.01 265)` - Light gray

### Dark Mode

- Background: `oklch(0.1 0.01 265)` - Dark purple-black
- Foreground: `oklch(0.98 0.005 265)` - Near white
- Primary: `oklch(0.6 0.2 265)` - Bright purple
- Accent: `oklch(0.55 0.2 200)` - Bright cyan
- Muted: `oklch(0.2 0.02 265)` - Dark purple-gray
- Muted-foreground: `oklch(0.6 0.02 265)` - Light gray
- Border: `oklch(0.2 0.02 265)` - Dark gray

---

## Typography

**Font families:**

- Sans: Geist (default for all text)
- Mono: Geist Mono (for work order IDs only)

**Text sizes:**

- Header title: `font-semibold` (16px, weight 600)
- Message content: `text-sm leading-relaxed` (14px, line-height 1.625)
- Citations: `text-xs` (12px)
- Helper text: `text-xs` (12px)
- Work order links: `text-xs font-mono font-medium` (12px monospace, weight 500)

---

## Interactive Behaviors

### Message Flow

1. User types in textarea
2. Press Enter (not Shift+Enter) or click Send button
3. Input clears immediately
4. User message appears instantly (right-aligned)
5. Loading indicator shows for ~800ms
6. Assistant response appears with citations (left-aligned)
7. ScrollArea auto-scrolls to bottom

### Intent Detection

The system analyzes user input for patterns:

- **View requests:** "show", "view", "list", "get", "find"
- **Troubleshooting:** "pack", "pressure", "fault", "symptom"
- **Create requests:** "create", "new", "add", "schedule"
- **Tail numbers:** Regex pattern `N\d{1,5}[A-Z]{1,3}`

### Work Order Linking

1. Backend returns content with `[WO-ID](wo://WO-ID)` format
2. Frontend parses and renders as clickable button
3. Click triggers `onWorkOrderClick(woId)` callback
4. Parent component handles navigation

---

## Data Structures

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

## Key Design Principles

1. **Flexbox-first layout** - Uses flex for all major layout decisions
2. **Design token consistency** - All colors reference CSS custom properties
3. **80% max-width rule** - Message bubbles never exceed 80% width
4. **Auto-scroll behavior** - Always scrolls to latest message
5. **Inline link parsing** - Work orders rendered as interactive buttons
6. **Citation transparency** - All AI responses include source citations
7. **Loading feedback** - Clear visual indicators during processing
8. **Keyboard accessibility** - Enter/Shift+Enter for input control
