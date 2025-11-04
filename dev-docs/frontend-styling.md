# Frontend Styling: MUI + Tailwind Hybrid Notes

The AI Browser workspace introduces Tailwind CSS alongside the existing MUI design system. This guide captures the ground rules so both systems coexist without regressions.

## Tooling

* Tailwind is configured via `frontend/tailwind.config.js` and compiled by CRA’s PostCSS pipeline.
* Global directives live in `src/index.css`; they only reset essentials so the MUI theme still governs typography.
* Utility classes are available in any `.tsx` file. Prefer Tailwind for layout scaffolding (`flex`, `grid`, `gap`, `w-*`, `bg-*`) and quick color tokens defined in `theme.extend.colors`.

## When to Reach for Tailwind

| Use Tailwind For | Rely on MUI For |
|------------------|-----------------|
| Responsive grids / flex layouts | Complex widgets (DataGrid, Dialog, Pickers) |
| Padding, spacing, sizing | Theme-aware typography variants |
| Quick status badges using custom palette tokens (`status-*`) | Component states driven by MUI props (`color`, `variant`) |
| Background gradients / shadows defined in config | Accessibility primitives baked into MUI components |

> Tip: Tailwind utility strings should stay concise. If a block exceeds ~8 utilities, consider extracting a styled MUI wrapper or a CSS module.

## Color Tokens

The Tailwind config mirrors core theme colors:

* `primary`, `secondary`, `success`, `warning`, `error`, `info`
* Neutral helpers: `surface`, `surface-muted`, `neutral-ink`
* Proposal badges: `status-draft`, `status-awaiting`, `status-committed`

Always cross-check new tokens with `theme/schemes/PureLightTheme.ts` to avoid divergent hex values.

## Accessibility

* Honor WCAG contrast ratios. Utility classes like `text-secondary` should only appear on high-contrast backgrounds (`bg-white`, `bg-surface`).
* Continue using MUI components for semantic elements (e.g., `Button`, `Typography`, `Chip`) even if Tailwind handles surrounding layout.
* Streaming regions in the AI Browser leverage `aria-live` + Tailwind spacing. Keep ARIA attributes in JSX and let Tailwind handle structure.

## Testing

Tailwind styles are runtime-generated. If a unit snapshot depends on a class string, assert on semantic behavior instead (text presence, button enabled state) to avoid brittle tests.

## Migration Tips

1. Keep the existing `sx` prop usage for view-specific overrides; Tailwind shouldn’t replace it wholesale.
2. For shared primitives, prefer small wrapper components that combine Tailwind layout with MUI internals (see `IntentWorkspace` layout patterns).
3. Run `npm run lint` + `npm run test` after introducing new utilities to catch class typos early.
