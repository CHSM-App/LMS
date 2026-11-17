# Design System

Colours are fixed by `guidelines/BRAND-THEME.md` and generated from `design-tokens/tokens.json`. This file covers everything else: type, spacing, layout and principles.

## Pass 1: plan
- **Subject:** a coaching-class platform. Students ask "what do I study or attend next?"; teachers ask "who is waiting for me?"
- **Type:** **Mukta** (Latin + Devanagari in one family, warm and rounded, and very readable on budget phones). One family only; hierarchy comes from weight (400 / 600 / 800) and size.
  - Scale (px): 13 · 14 · **16 body** · 19 (button labels, card titles) · 23 · 28 · 34 · 42.
  - Line height: 1.6 body (the extra room for Devanagari matras), 1.25 headings. No letter-spacing, no all-caps, no italics.
- **Spacing:** 4-point scale: 4, 8, 12, 16, 24, 32, 48, 64.
- **Radius encodes hierarchy:**
  - 6 for inputs and badges
  - 10 for buttons
  - 16 for cards and panels
  - pill shape only for status badges and the progress track
- **Layout:**
  ```
  App shell (teacher/admin/student)        Public course page
  ┌────────┬───────────────────────┐       ┌───────────────────────────────┐
  │ NAVY   │ page title    [CTA]   │       │ logo   Courses  Teach  [Login] │ white header
  │ sidebar│───────────────────────│       ├───────────────────────────────┤
  │ ▌Active│ ┌white card─────────┐ │       │ ICE background                 │
  │  Item  │ │ table / form       │ │       │ Title (34/800, navy)           │
  │  Item  │ └───────────────────┘ │       │ ┌video 16:9┐ ┌white card─────┐ │
  │        │ ICE page background   │       │ │ demo 1   │ │ teacher       │ │
  └────────┴───────────────────────┘       │ └──────────┘ │ [Book demo]   │ │
                                           │              │ [Enroll now]  │ │
  Mobile (<768): the sidebar becomes a top  │              └───────────────┘ │
  bar + drawer; the CTA sticks to the bottom└───────────────────────────────┘
  ```
  Content is left-aligned everywhere. Centred text is used only for empty states.
- **Principles:**
  1. Ice is the room, White is the paper, Navy is the ink. Orange appears **once or twice per screen**, only where the next action is.
  2. Progress is always visible: Lime bars with a written %, ticks on completed lessons.
  3. Calm dashboards: no decorative motion. Motion only answers an action: a drawer opens, a toast confirms.
  4. Every status shows a word and an icon, never colour alone.
- **The memorable thing:** the **"Next up" card** on the student dashboard. It is a white card with a thick Orange left edge, a Lime progress bar, and one Orange "Continue" button. Everything else stays quiet.

## Pass 2: review against generic defaults
- A cream background or serif display? No. The background is the owner's Ice and the type is Mukta.
- The SaaS-card kit (identical cards, one radius, grey shadow)? **Changed:** the radius now varies by hierarchy, and shadows use a Navy tint and appear only on raised elements (modals, dropdowns). Cards are flat white on Ice with a hairline Navy 16% border.
- All-caps eyebrows, `→` on buttons, middle-dot meta strings? **Removed.** Buttons name the action ("Book live demo"), and meta information uses separate labelled lines.
- A big-number hero? **Changed:** the public home opens with search ("What do you want to learn?") plus real course cards, because finding a course is the job of that page.
