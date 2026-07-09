# Zettra — design system

This file is the source of truth for Zettra's visual language. Tools like
[impeccable.style](https://impeccable.style) read it to respect the system instead of imposing
generic defaults. Human contributors: keep it in sync with `apps/client/src/index.css` (tokens)
and `apps/client/src/ui/` (components).

## Modes

- **Product** (the app: `App`, sidebar, editor, views) — calm, dense, keyboard-first, dark by
  default. Optimize for long working sessions, not first impressions. No hero motion, no
  decorative gradients inside working surfaces.
- **Brand** (onboarding `Auth`, the `Demo` gallery) — may use the accent gradient, a marketing
  hero, and entrance motion.

## Design tokens (semantic, theme-aware)

Defined once in `index.css` and exposed to Tailwind via `@theme inline`. Never hard-code hex in
components; use the token.

| Token                                | Role                             |
| ------------------------------------ | -------------------------------- |
| `--bg`, `--surface`, `--surface-2/3` | page → raised surfaces           |
| `--hover`                            | hover fill                       |
| `--border`, `--border-strong`        | hairline / stronger dividers     |
| `--text`, `--muted`, `--faint`       | primary → de-emphasized text     |
| `--accent`, `--accent-2`             | violet accent + gradient partner |
| `--accent-contrast`                  | text on accent                   |
| `--green/amber/red/blue`             | status                           |
| `--ring`                             | focus ring                       |
| `--shadow-sm/shadow/shadow-lg`       | elevation                        |

Light and dark are both first-class (`[data-theme]` on `<html>`, `system` follows the OS).

## Type & spacing

- Font: Inter (sans), a mono stack for code/formulas.
- Scale: page title `text-2xl/3xl` bold; section kicker is `text-xs` uppercase, tracked, `--accent`.
- Rhythm: multiples of 4px. Radii: `--radius-sm` 7, `--radius` 10, lg 12, xl 16, 2xl 22.

## Components (reuse — do not re-roll)

`src/ui/`: `Button` (primary/secondary/ghost/danger), `Card`, `Badge` (tone-scoped), `Input`+`Field`,
`Spinner`, `EmptyState`, `Avatar`, `Segmented`, `ThemeSwitcher`, `IconButton`.
`src/blocks/`: `Callout`, `BookmarkCard`, `WeatherCard`, `KanbanBoard`, `FormulaTable`,
`CoverHeader`, `Checklist`.

## Anti-patterns to avoid

- Hard-coded colors instead of tokens (breaks theming).
- Ghost cards / empty decorative panels in the product surface.
- Gradient text or hero motion inside the working app (brand mode only).
- New one-off buttons/inputs instead of the `ui/` kit.
- Focus states removed; every interactive element keeps a visible `--ring`.
- Low-contrast muted text on muted surfaces (respect the `--muted`/`--faint` split).
