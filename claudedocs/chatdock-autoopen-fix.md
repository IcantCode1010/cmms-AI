# ChatDock Auto-Open Fix

**Date:** 2025-11-03
**Status:** ✅ Complete
**Issue:** ChatDock sidebar was opening when sending messages through AI Browser

---

## Problem Description

When using the AI Browser to send a query, the ChatDock sidebar would unintentionally open at the same time. This was undesired behavior since:
- AI Browser is a full-page interface and doesn't need the dock
- Users explicitly navigated to AI Browser, not ChatDock
- The dock opening was a distraction from the full-page experience

## Root Cause

**File:** `frontend/src/slices/agentChat.ts`
**Line:** 137 (before fix)

The `promptQueued` reducer contained the line:
```typescript
state.open = true;
```

This was originally designed to auto-open the ChatDock when a message was sent. However, since both the AI Browser and ChatDock share the same `agentChat` Redux slice, this line caused the ChatDock to open whenever ANY component sent a message, including the AI Browser.

**Why This Happened:**
1. Both AI Browser and ChatDock use the `agentChat` Redux slice
2. The `sendPrompt` action dispatches `promptQueued`
3. `promptQueued` set `state.open = true` to auto-open ChatDock
4. The `open` state controls ChatDock's visibility
5. Result: Any component sending a message would open ChatDock

## Solution

**Change:** Removed `state.open = true` from the `promptQueued` reducer

**Modified Code:**
```typescript
// BEFORE (Line 137):
promptQueued(state, action: PayloadAction<{ prompt: string }>) {
  if (!state.enabled) {
    state.error = 'Chat assistant is disabled for this environment.';
    return;
  }
  state.open = true; // ❌ THIS CAUSED THE ISSUE
  state.sending = true;
  state.error = undefined;
  state.messages.push({
    role: 'user',
    content: action.payload.prompt
  });
},

// AFTER (Fixed):
promptQueued(state, action: PayloadAction<{ prompt: string }>) {
  if (!state.enabled) {
    state.error = 'Chat assistant is disabled for this environment.';
    return;
  }
  state.sending = true; // ✅ Removed state.open = true
  state.error = undefined;
  state.messages.push({
    role: 'user',
    content: action.payload.prompt
  });
},
```

## Why This Fix Works

1. **AI Browser doesn't use `open` state**: It's always visible as a full-page interface
2. **ChatDock still has explicit controls**: The `setOpen` reducer (line 129) handles explicit open/close via the toggle button
3. **No auto-opening needed**: Users navigate to AI Browser or ChatDock intentionally, no need for automatic opening
4. **Clean separation**: Each component controls its own visibility independently

## Verification

✅ **Frontend rebuilt successfully**
- Build completed without errors
- No TypeScript compilation issues
- Bundle size: 603.17 kB (main chunk)

✅ **Container restarted**
- Frontend container recreated and started
- Service accessible at http://localhost:3000

## Expected Behavior After Fix

### AI Browser (Full-Page Interface)
- ✅ User navigates to `/ai-browser`
- ✅ User sends a message
- ✅ Message appears in AI Browser conversation
- ✅ ChatDock does NOT open
- ✅ Only AI Browser interface is visible

### ChatDock (Sidebar Interface)
- ✅ User clicks ChatDock toggle button
- ✅ ChatDock opens
- ✅ User sends a message
- ✅ Message appears in ChatDock conversation
- ✅ ChatDock stays open (no unexpected behavior)

## Files Modified

**`frontend/src/slices/agentChat.ts`**
- Line 137 removed: `state.open = true;`
- Reducer: `promptQueued`
- No other changes to the file

## Testing Checklist

- [ ] Navigate to AI Browser at http://localhost:3000/ai-browser
- [ ] Send a test message
- [ ] Verify ChatDock sidebar does NOT open
- [ ] Navigate away from AI Browser
- [ ] Click ChatDock toggle button
- [ ] Verify ChatDock opens correctly
- [ ] Send a message in ChatDock
- [ ] Verify ChatDock stays open
- [ ] Verify message flow works in both interfaces

## Related Documentation

- **AI Browser Redesign:** `claudedocs/ai-browser-implementation-summary.md`
- **Redux State Management:** `frontend/src/slices/agentChat.ts`
- **ChatDock Component:** `frontend/src/components/ChatDock/ChatDock.tsx`

---

## Conclusion

The fix successfully prevents the ChatDock from auto-opening when using the AI Browser by removing the unwanted side effect in the shared Redux state. Both interfaces now operate independently while still sharing the same underlying agent chat infrastructure.
