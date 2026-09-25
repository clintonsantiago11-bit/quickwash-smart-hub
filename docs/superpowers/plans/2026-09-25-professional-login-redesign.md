# Professional Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the fake coin-terminal login with a professional, responsive QuickWash operations sign-in, a reusable water-and-soap brand mark, and a restrained loading-only credential slot used while the account is verified.

**Architecture:** Keep the existing API contract and 75-second login timeout. Replace only presentation: a `LoginPhase` state machine drives a concise form/status panel, a dependency-free `QuickWashMark` SVG supplies one identity everywhere, and a compact loading-only slot provides visible verification feedback without the old 3D coin panel. Delete unused faceplate and coin components instead of preserving dead abstractions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Lucide React, Node test runner.

**Spec:** Preserve the navy/cyan theme; remove `valid`, laundry copy, fake telemetry, and the nonfunctional recovery link; use Email/Password/Sign in; introduce the water-and-soap mark in login and the site sidebar/browser icon; keep the Sign in loading spinner and add a loading-only credential slot with the status “Verifying account”.

## Global Constraints

- Do not change Laravel authentication, token handling, credentials, or the 75-second cold-start timeout.
- Add no dependency.
- Inputs retain type, name, autocomplete, labels, inline errors, and password-manager support.
- Controls have hover, focus-visible, active, and disabled/loading states.
- Respect reduced motion and prevent horizontal overflow.
- Mark brand text `translate="no"`.

---

### Task 1: Lock the login UI contract

**Files:**
- Create: `frontend/src/lib/login-ui.test.mjs`

**Interfaces:**
- Consumes: login page, credential form, shared mark, sidebar, and browser icon source.
- Produces: Node assertions for approved copy, removed decorative behavior, and brand adoption.

- [x] Assert the form contains `Email`, `Password`, `Remember email`, and `Sign in`.
- [x] Assert login source rejects `valid`, `Operator Email`, `Password Access`, `Forgot Key?`, `INSERT COIN`, `CoinMech`, `Faceplate`, and droplet imports.
- [x] Assert Sidebar and browser icon use the Q identity rather than a droplet.
- [x] Run `npm test`; expect RED because the mark and copy do not exist.

### Task 2: Add identity and simplify the form

**Files:**
- Create: `frontend/src/components/QuickWashMark.tsx`
- Modify: `frontend/src/components/login/CredentialForm.tsx`
- Modify: `frontend/src/lib/auth.ts`

**Interfaces:**
- Produces: `QuickWashMark({ className?, title? }): React.JSX.Element`.
- Produces: `LoginPhase = 'idle' | 'loading' | 'success' | 'error'`.
- Consumes: existing form submit/error/clear contract.

- [x] Add an accessible geometric water-and-soap SVG without an external asset.
- [x] Change field and action copy to plain product language; remove valid-state text and fake reset link.
- [x] Add `isSubmitting`; disable controls and show `Signing in…` during the request.
- [x] Add `spellCheck={false}`, balanced heading, 16 px mobile input, and visible focus.
- [x] Run the UI test; expect remaining page/sidebar/icon assertions to fail.

### Task 3: Replace the login scene and reuse the mark

**Files:**
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/app/icon.svg`
- Delete: `frontend/src/components/login/CoinMech.tsx`
- Delete: `frontend/src/components/login/Faceplate.tsx`

**Interfaces:**
- Consumes: credential form, login phase, shared mark, `api.login`, and `validateCredentials`.
- Produces: responsive two-column desktop / one-column mobile login with honest status states.

- [x] Remove mouse spotlight, ambient pulse, fake telemetry, waterline, old coin motion, and phase auto-reset; keep a compact loading-only credential slot.
- [x] Build the approved restrained product scene and simple form panel.
- [x] Map errors to actionable messages and expose a working `Try again` action.
- [x] Replace Sidebar and browser droplets with the shared water-and-soap identity.
- [x] Run the UI test; expect PASS.

### Task 4: Replace obsolete CSS

**Files:**
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: `.login-*` style contract consumed by page and form.

- [x] Delete faceplate, bolt, old coin, scanner, VFD, watermark, and ambient-loop rules; add the loading-only credential-slot styles and reduced-motion handling.
- [x] Add static gradient/grid, focus-within fields, status panels, and reduced-motion handling.
- [x] Search for old selectors; expect none.

### Task 5: Verify and inspect

**Files:** All modified files.

- [x] Run `npm test`; all pass.
- [x] Run `npm run lint`; zero errors.
- [x] Run `npx tsc --noEmit`; zero errors.
- [x] Run `npm run build` with the environment-compatible webpack path; succeeds.
- [x] Launch locally and capture 360 px, 768 px, and 1280 px; inspect clipping, hierarchy, focus, and states.
- [x] Run `git diff --check`; review for secrets, dead imports, and unrelated changes.
