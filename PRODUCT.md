# Zettra — product brief

Context for design/AI tooling (e.g. [impeccable.style](https://impeccable.style)).

## What it is

Zettra is a self-hosted, collaborative "second brain": a universal **Briefkasten** (inbox)
capture layer, **supertag**-driven structure, saved **views**, and AI-assisted **smart
connections** between notes. Think Tana/Notion, but self-hosted and permission-scoped.

## Who it's for

Individuals and teams who want a fast, keyboard-first knowledge tool they run on their own
infrastructure — privacy-conscious, offline-capable, no vendor lock-in.

## Tone

Calm, precise, trustworthy. Dense but never cramped. The product should feel like a focused
tool for thought, not a marketing site. Dark by default; light fully supported.

## Primary surfaces

- **Onboarding** (`Auth`) — brand mode: a two-panel hero that sells the idea.
- **App shell** — a Tana-style sidebar (Create new + search, primary nav, tag folder tree,
  spaces), a breadcrumbed page with a large title and `#tag` pills, a collaborative block
  editor, and a right rail of contextual cards (Open tasks, Related).
- **Capture** — a drag-and-drop Dropbox and a "For Review" triage bucket.
- **Databases** — table/board/gallery/calendar views; tables with cross-references, rollups,
  and conditional formatting.

## Admin / preview tooling

Preview builds expose an **admin mode** (`?admin=1`) with a design **annotation overlay**:
pin any element, leave a note, and "Copy for agent" to hand the review to the coding agent.
It never renders for end users.

## Non-goals

- No social/feed mechanics. No gamification. No dark patterns.
- Not a public publishing platform (v1 is private workspaces).
