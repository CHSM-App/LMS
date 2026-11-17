# Phase 2: Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one visual identity for the LMS: written tokens, web CSS variables and components, and a matching Flutter theme and widgets.

**Architecture:** `docs/DESIGN.md` holds the decisions. `web/src/design/tokens.css` and `mobile/lib/core/theme/` both implement them. Components are built once and reused by every role's screens.

**Tech Stack:** CSS custom properties (no CSS framework), React components, Vitest + Testing Library; Flutter `ThemeData` + `ThemeExtension`.

**Spec:** `guidelines/lms-full-build-prompt.md` §9 (Phase 2). Guides: **`guidelines/DESIGN-BRIEF.md` (the brief)** + `guidelines/frontend.md` (the two-pass process). Brand name and colours are still TBD, so build with placeholders and keep every value in tokens so a rebrand is a one-file change.

## Global Constraints
- The look must be distinctive and avoid the generic AI defaults listed in frontend.md: cream + serif + terracotta, near-black + acid accent, broadsheet layout, the SaaS-card kit, ALL-CAPS eyebrows, `→` on buttons.
- The audience is Indian teachers and students using mobile first. Text must render Devanagari (Marathi/Hindi) well.
- Accessible: WCAG AA contrast, visible keyboard focus, `prefers-reduced-motion` respected, works at 360 px width.
- **Light theme only. Fixed palette from `guidelines/BRAND-THEME.md`.** All colours are generated from `design-tokens/tokens.json` (Style Dictionary) into the web CSS/JS and Flutter Dart. A palette-lock test, a contrast test and a no-raw-colours check guard them.
- Status colours are used everywhere: Pending, Approved, Rejected, Blocked.

## Review Focus
1. **Long Marathi/Hindi words** in buttons and table cells must wrap or truncate, not overflow. Covered by the Task 3 render test with a long `mr` string.
2. **Phone width 360 px:** tables become a stacked list with no horizontal page scroll. Task 3.
3. **Keyboard only:** every interactive component is reachable with Tab and shows a focus ring. Task 3.
4. **Pasting a 6-digit OTP into OtpInput** fills all boxes. Task 3.
5. **Brand drift:** someone types a hex colour into a screen, or changes the palette. Task 2 palette-lock test + `scripts/check-no-raw-colors.js`.

## File Structure
```
docs/DESIGN.md
web/src/design/tokens.css, global.css
web/src/components/{Button,Input,Select,OtpInput,Table,Modal,Toast,StatusBadge,EmptyState,FileUpload,PageHeader}.jsx (+ .css)
web/src/components/__tests__/*.test.jsx
web/src/design/__tests__/contrast.test.js
web/src/pages/StyleGuide.jsx   (dev-only route /_styleguide)
mobile/lib/core/theme/app_theme.dart, app_colors.dart, app_text.dart
mobile/lib/widgets/{app_button,otp_input,status_badge,empty_state,app_text_field}.dart
mobile/test/widgets/*_test.dart
```

---

### Task 1: Design plan (DESIGN.md)

**Files:** Create `docs/DESIGN.md`

- [ ] **Step 1:** Pass 1. Write the plan:
  - **Subject:** what the product is, who it's for, and the main job of each role's screens.
  - **Colour:** 4–6 named hex values, plus status colours and dark-mode values.
  - **Type:** one or two families that support Devanagari (e.g. *Mukta*, *Hind*, *Noto Sans Devanagari*, *Baloo 2*), with roles, a type scale (ratio and px values), weights and line-heights. Devanagari needs about 10% more line-height than Latin.
  - **Spacing scale and radius rules:** radius encodes hierarchy, not one value everywhere.
  - **Layout:** ASCII wireframes for the public home page, the course details page and the dashboard shell.
  - **Principles:** 3–5 lines, plus the single "memorable thing".
- [ ] **Step 2:** Pass 2. Review the plan against frontend.md's list of defaults. Rewrite anything generic, and record **what changed and why** at the bottom of DESIGN.md.
- [ ] **Step 3:** Commit `docs: design system plan`.

### Task 2: Central design tokens (web + Flutter)

**Files:** Create `design-tokens/{package.json, tokens.json, build.js, tests/tokens.test.js}`, `scripts/check-no-raw-colors.js`. Generated: `web/src/design/tokens.css`, `web/src/design/tokens.js`, `mobile/lib/core/theme/app_tokens.g.dart`. Also `web/src/design/global.css`.

**Interfaces:** CSS variables `--color-<semantic>` (e.g. `--color-bg-page`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-action-primary`, `--color-link-underline`, `--color-nav-bg`, `--color-nav-active`, `--color-success`, `--color-error`, `--color-focus`, `--color-border`, `--status-<name>-{bg,fg}`), plus `--font-*`, `--text-*`, `--space-*` and `--radius-*`. Dart: `AppTokens.<name>` constants.

- [ ] **Step 1:** Write the failing tests:
  - Palette lock: `brand.*` = exactly the 6 BRAND-THEME hex values, and `functional.error` = `#C62828`.
  - Contrast: every pair in the BRAND-THEME table meets its stated ratio.
  - The generator emits CSS, JS and Dart with identical values.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement `build.js` (a small Node generator: tokens.json → 3 outputs). `global.css` sets the reset, base type, `:focus-visible` ring and the reduced-motion rule. **Step 4:** Run and see it pass.
- [ ] **Step 5:** `check-no-raw-colors.js` fails on a hex or `rgb(` literal in `web/src/**` or `mobile/lib/**` outside the generated files. Commit `feat: central design tokens`.

### Task 3: Web components

**Files:** Create the components listed above. Test: `web/src/components/__tests__/*.test.jsx`

**Interfaces (props):**
- `Button({ variant:'primary'|'secondary'|'danger'|'ghost', size:'sm'|'md', loading, disabled, onClick, children })`
- `Input({ label, name, error, hint, ...inputProps })` and `Select({ label, options:[{value,label}], error })`
- `OtpInput({ length=6, value, onChange, disabled })`
- `Table({ columns:[{key, header, render?}], rows, empty, loading })`. Below 640 px it renders as a stacked card list.
- `Modal({ open, title, onClose, children, footer })`. Traps focus and closes on Esc.
- `Toast` via `useToast().show({ kind:'success'|'error', message })`
- `StatusBadge({ status:'pending'|'approved'|'rejected'|'blocked'|'draft'|'published'|'expired'|'paused' })`. Label text comes from i18n.
- `Banner({ kind:'info'|'warning'|'error', message, action })`, used for the "subscription ended" (limited mode) and "read-only course" notices.
- `UploadProgress({ fileName, percent, onCancel, onRetry })` for resumable uploads.
- `VideoFrame({ source:{type:'upload'|'youtube'|'vimeo'|'bunny', url} })`: one player frame for uploaded and linked videos.
- `EmptyState({ title, action })`, `FileUpload({ accept, maxMb, onFile, error })`, `PageHeader({ title, actions })`

- [ ] **Step 1:** Write the failing tests:
  - `Button` with `loading` is disabled and has `aria-busy="true"`.
  - Pasting `"123456"` into `OtpInput` calls `onChange("123456")`. Backspace moves focus back.
  - `Table` with `rows=[]` renders `empty`.
  - `Modal` closes on Escape and returns focus to its trigger.
  - `StatusBadge status="rejected"` renders the `t('status.rejected')` text.
  - `FileUpload maxMb={5}` with a 6 MB file shows the error "File is larger than 5 MB".
  - A long Marathi label in `Button` has `overflow-wrap:anywhere`.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. **Step 4:** Run and see it pass.
- [ ] **Step 5:** Add a dev-only `/_styleguide` page that shows every component in every state, in both themes. Check it manually at 360 px and 1280 px.
- [ ] **Step 6:** Commit `feat(web): core components`.

### Task 4: Flutter theme + widgets

**Files:** Create `mobile/lib/core/theme/*`, `mobile/lib/widgets/*`. Test: `mobile/test/widgets/*`

**Interfaces:** Produces `AppTheme.light()` and `AppTheme.dark()` returning `ThemeData`, and `AppColors` as a `ThemeExtension` carrying the status colours. The widgets `AppButton`, `AppTextField`, `OtpInput`, `StatusBadge` and `EmptyState` have the same props as the web components.

- [ ] **Step 1:** Write failing widget tests:
  - `OtpInput` paste fills 6 boxes and calls `onCompleted`.
  - `StatusBadge('blocked')` uses `AppColors.blockedBg`.
  - `AppButton(loading:true)` is not tappable.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement, using the same hex values and font as `tokens.css` (bundle the fonts under `assets/fonts`). **Step 4:** Run `flutter test` and see it pass.
- [ ] **Step 5:** Commit `feat(mobile): theme and shared widgets`.

## Phase done when
- [ ] DESIGN.md has both passes and the "what changed" section.
- [ ] `web: npm test` and `mobile: flutter test` pass. The style guide looks right at 360 px in light and dark.
- [ ] Every Review Focus item has a passing test.
