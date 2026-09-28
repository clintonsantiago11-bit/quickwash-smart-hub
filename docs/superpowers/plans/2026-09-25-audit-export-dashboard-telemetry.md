# Audit Export + Dashboard Telemetry Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the audit log a real Excel/CSV/PDF download, remove the Wax Tank from the dashboard, and make Main Wash Bay Status follow the live NAEK 3-in-1 timer.

**Architecture:** Three pure, testable modules hold the logic: `lib/export.ts` (row → file), `lib/dashboard.ts` (tank normalisation + bay status resolution), and the existing pages stay presentational. The backend stops emitting the Wax Tank row; the frontend also normalises defensively so a stale API cannot reintroduce it. NAEK liveness comes from the `naek_carwash_1` heartbeat in `GET /devices` plus `naek_update` socket events for live cycles. No visual/layout change to the dashboard.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind v4, Node test runner, Laravel 11, `exceljs` + `jspdf` (both MIT, dynamic-imported only when selected).

## Global Constraints

- CSV must use the existing native Blob pattern (no library).
- Excel/PDF libraries are loaded via dynamic `import()` so the initial bundle is unchanged.
- No dashboard design, layout, colour, or copy changes.
- Wash bay status precedence: jam (ESP32 `error`) > NAEK active cycle > NAEK live (`available`) > unknown.
- Never surface a `Wax Tank` gauge.
- Tests must fail before implementation.

---

### Task 1: Shared row-export module

**Files:**
- Create: `frontend/src/lib/export.ts`
- Create: `frontend/src/lib/export.test.mjs`

**Interfaces:**
- Produces `toMatrix(rows: Record<string, unknown>[]): { header: string[]; body: (string|number)[][] }`
- Produces `toCsv(matrix): string` (RFC 4180 quoting)
- Produces `exportRows(rows, filename, format: 'excel'|'csv'|'pdf'): Promise<void>`

- [ ] Write failing tests: header order from first row keys, values coerced to string, commas/quotes/newlines escaped, empty rows still emit the header.
- [ ] Run `npm test`; expect failure (module missing).
- [ ] Implement `toMatrix`/`toCsv`; `exportRows` dispatches to Blob (csv), `exceljs` (`new Workbook()`, `addWorksheet`, `addRows`, `xlsx.writeBuffer()`), `jspdf` (`new jsPDF()`, `text`, `splitTextToSize`, `save`).
- [ ] Run `npm test`; expect pass.

### Task 2: Audit log download control

**Files:**
- Modify: `frontend/src/app/audit/page.tsx`

**Interfaces:**
- Consumes `exportRows`, existing `AuditItem[]`, `getActionLabel`.

- [ ] Add `Download` icon, a format `<select>` (Excel/CSV/PDF), and a Download button in the filter bar.
- [ ] Map each `AuditItem` to `{ Timestamp, User, IP, Action, Details }` using `getActionLabel`; disable while exporting; label the button with the chosen format.

### Task 3: Remove the Wax Tank

**Files:**
- Modify: `backend/app/Http/Controllers/Api/DashboardController.php` (drop the `Wax Tank` row)
- Modify: `frontend/src/app/page.tsx` (use `normalizeSupplies`)
- Create: `frontend/src/lib/dashboard.ts`, `frontend/src/lib/dashboard.test.mjs`

**Interfaces:**
- Produces `normalizeSupplies(raw): SupplyItem[]` returning exactly Water Tank, Soap Tank A, Soap Tank B with fixed colours, dropping unknown labels and coercing levels to `number | null`.

- [ ] Failing test: backend payload containing a Wax Tank still yields exactly three gauges; missing keys yield `null` levels.
- [ ] Implement `normalizeSupplies`; apply to `data.supplies` and the socket `levels` payload.

### Task 4: NAEK-driven wash bay status

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Extend: `frontend/src/lib/dashboard.ts`, `dashboard.test.mjs`

**Interfaces:**
- Produces `resolveBayStatus({ esp32Status, naekOnline, naekCycle }): { status, hasStatus, online }`
- Produces `naekCycleFromEvents(events): { name, durationSeconds } | null` (first `sale` event; `count > 1` multiplies duration).

- [ ] Failing tests: NAEK online + no cycle → available/online; NAEK sale → active; ESP32 `error` → error even with NAEK online; no sources → `hasStatus: false`; non-sale events ignored.
- [ ] Implement helpers; in the page set `bay.online/hasStatus` from the `naek_carwash_1` device row, subscribe to `onNaekUpdate` for snapshots (liveness) and sale events (active cycle with a cleared timer), keeping the ESP32 jam path.

### Task 5: Verify

- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit`, `next build --webpack`.
- [ ] Browser: audit format select + real file download (all three), dashboard shows three tanks only, wash bay reflects a mocked NAEK sale then returns to available.
- [ ] `git diff --check`; confirm no layout/design change in the dashboard diff.
