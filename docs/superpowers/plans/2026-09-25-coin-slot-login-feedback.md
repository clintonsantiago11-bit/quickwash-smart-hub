# Coin-Slot Login Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the plain sign-in spinner with a clear vending-machine sequence: insert a credential coin, authenticate, jam on bad credentials, and replay insertion when retrying.

**Architecture:** Extend the existing `LoginPhase` state machine instead of adding loose booleans. The login page owns the asynchronous timing and API result, a focused presentational component renders the current mechanical state, and CSS supplies the animation with a reduced-motion fallback. Existing API, validation, field errors, and professional card layout remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, CSS, Node test runner.

## Global Constraints

- Do not add a dependency; `motion` is installed but CSS is sufficient for this fixed state machine.
- Credential, network, timeout, and server failures retain typed messages and retry behavior.
- Only invalid credentials produce the coin-jam state.
- Interactive controls remain keyboard accessible and expose clear busy/disabled states.
- `prefers-reduced-motion` must disable the coin and slot motion.
- Do not redesign the surrounding login page.

---

### Task 1: Lock the behavior with a failing regression test

**Files:**
- Modify: `frontend/src/lib/login-ui.test.mjs`

**Interfaces:**
- Consumes: source of `auth.ts`, `login/page.tsx`, `CredentialForm.tsx`, and `globals.css`.
- Produces: regression contract for `LoginPhase`, `CoinSlotFeedback`, and the four visible states.

- [x] Replace the generic loading assertions with assertions for `inserting`, `authenticating`, `jam`, `success`, `CoinSlotFeedback`, `login-coin-jam`, `login-coin-drop`, and `prefers-reduced-motion`.
- [x] Run `npm test` and verify it fails because the new state/component does not exist.

### Task 2: Implement the typed coin-slot lifecycle

**Files:**
- Modify: `frontend/src/lib/auth.ts`
- Modify: `frontend/src/app/login/page.tsx`

**Interfaces:**
- Produces: `LoginPhase = 'idle' | 'inserting' | 'authenticating' | 'success' | 'jam' | 'error'`.
- Produces: `CoinSlotFeedback({ phase, signedInName })` for active and success states.
- Consumes: `api.login`, `validateCredentials`, and `LoginError.kind`.

- [x] Change `LoginPhase` to the six invalid-state-safe values above.
- [x] Add a short insertion delay before `api.login`, then move to `authenticating` while the request is pending.
- [x] Map `LoginError('credentials')` to `jam`; map network, timeout, and server failures to `error`.
- [x] Prevent duplicate submissions, cancel delayed attempts on unmount, and preserve retry behavior.
- [x] Render the feedback component during insertion/authentication and during the success handoff.

### Task 3: Render and animate the current card's coin mechanism

**Files:**
- Create: `frontend/src/components/login/CoinSlotFeedback.tsx`
- Modify: `frontend/src/components/login/CredentialForm.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `phase` and optional `signedInName`.
- Produces: semantic status UI and state-specific CSS classes.

- [x] Replace the inline pulsing token with `CoinSlotFeedback` and pass the full phase rather than a boolean.
- [x] Copy by state: `Inserting credential`, `Authenticating`, `Coin jammed`, `Coin accepted`, and `Sign-in unavailable`.
- [x] Animate insertion as a coin dropping into the slot; scan during authentication; shake and expose a red-stuck coin on jam; clear/green on success.
- [x] Keep the credential rejection alert and retry button, using the retry action to replay the insertion sequence.
- [x] Add reduced-motion rules that leave each state visible without movement.

### Task 4: Verify the complete feature

**Files:**
- Verify all files above.

- [x] Run `npm test` and confirm the new contract passes.
- [x] Run `npm run lint` and `npx tsc --noEmit` with zero errors.
- [x] Run the production Next.js build and require exit code 0.
- [x] Exercise the login screen in a browser at desktop and 390px mobile widths.
- [x] Inspect loading, credential-jam, retry, console, and overflow states; run `git diff --check` and review the final diff.
