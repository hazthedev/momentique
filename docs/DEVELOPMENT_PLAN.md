# Galeria Development Plan

Source of Truth: This is the single authoritative development progress tracker for this repository.
Last Verified: 2026-02-19
Verification Basis: Current codebase state, route/component/module presence, local `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npm run build`, `npm audit --omit=dev`, and `npm run security:snyk`.

## Current Snapshot (2026-02-19)

Core release-blocking quality gates now pass locally (lint/typecheck/build/tests/security audit), and high-risk auth/realtime/CAPTCHA contract drift has been hardened. Remaining work is now primarily production hardening depth (test expansion, rollback policy maturity, and large-file maintainability).

## Verified Completed

### Architecture and Refactor Work
- [x] Split guest event page into smaller units (`app/e/[eventId]/_components`, `app/e/[eventId]/_hooks`, `app/e/[eventId]/_lib`)
- [x] Extracted photo/event service layer (`lib/services/event-photos.ts`, `lib/services/events.ts`)
- [x] Added validation schemas (`lib/validation/auth.ts`, `lib/validation/events.ts`)
- [x] Centralized tenant constants (`lib/constants/tenants.ts`)
- [x] Added route-level loading/error pages for key event routes (`app/e/[eventId]/loading.tsx`, `app/e/[eventId]/error.tsx`, `app/organizer/events/[eventId]/loading.tsx`, `app/organizer/events/[eventId]/error.tsx`)

### Admin UI Modularization
- [x] Lucky draw admin modularized into tabs/modules (`components/lucky-draw/admin/*`)
- [x] Settings admin modularized into tabs/hooks/types (`components/settings/*`)

### API Surface and Feature Coverage
- [x] Event APIs for photos, lucky draw, photo challenge, attendance, stats, download/export are present (`app/api/events/[eventId]/*`)
- [x] Admin APIs for users, tenants, moderation, settings, stats, activity are present (`app/api/admin/*`)
- [x] Organizer auth + ownership checks enforced for photo-challenge mutation routes (`app/api/events/[eventId]/photo-challenge/route.ts`)
- [x] Multi-tenant login lookup implemented across active tenants with tenant hinting (`app/api/auth/login/route.ts`)
- [x] Lucky draw config creation now enforces authenticated organizer/super-admin access and persists `createdBy` from authenticated user (`app/api/events/[eventId]/lucky-draw/config/route.ts`, `lib/lucky-draw.ts`)

### Baseline Automated Tests (Local)
- [x] `lib/rate-limit.test.ts` passes
- [x] `lib/upload/validator.test.ts` passes
- [x] `lib/upload/image-processor.test.ts` passes
- [x] `lib/recaptcha.test.ts` passes

### Production Hardening and Release Gates
- [x] Upload auth path no longer trusts unsigned JWT decode (`lib/services/event-photos.ts`)
- [x] Shared tenant resolver now blocks silent default-tenant behavior in production for hardened routes (`lib/api-request-context.ts`)
- [x] CAPTCHA fallback contract is aligned end-to-end (`components/auth/Recaptcha.tsx`, `app/api/auth/recaptcha/challenge/route.ts`, `app/api/auth/recaptcha/verify/route.ts`, `lib/recaptcha.ts`)
- [x] Internal error detail leakage removed from prize-claim 5xx response (`app/api/events/[eventId]/photo-challenge/claim/route.ts`)
- [x] Lucky draw/attendance/event mutation routes moved to required tenant-resolution paths for production-safe behavior (`app/api/events/[eventId]/*`)
- [x] Security dependency overrides updated (`fast-xml-parser`, `minimatch`) and lockfile refreshed (`package.json`, `package-lock.json`)
- [x] CI quality workflow added for build/lint/typecheck/test (`.github/workflows/ci.yml`)
- [x] Security workflow no longer suppresses key failures via `continue-on-error` (`.github/workflows/security.yml`)
- [x] Health endpoints are present and routable (`app/api/health/route.ts`, `app/api/auth/health/route.ts`)
- [x] Remaining `app/api` + `lib/services` silent default-tenant fallbacks removed in favor of resolver-based production-safe handling.

## Verified In Progress

These areas are present and partially implemented, but not yet complete based on current code/TODO markers.

- [ ] Photo pipeline hardening (legacy helper TODOs still open in `lib/images.ts`)
- [ ] Realtime consistency improvements (current implementation is Supabase client-based; historical WebSocket plan items are not aligned)
- [ ] Architecture-quality backlog from previous tracker remains open:
  - stable list keys
  - component tests for admin/organizer surfaces
  - API integration tests
  - API error/logging standardization

## Verified Open Gaps

### reCAPTCHA / Moderation Config Completeness
- [ ] Tenant-specific reCAPTCHA settings fetch TODO (`lib/recaptcha.ts`)
- [ ] reCAPTCHA stats collection TODO (`lib/recaptcha.ts`)
- [ ] Tenant-specific moderation config load TODO (`lib/moderation/auto-moderate.ts`)

### Image Utility Legacy Stubs
- [ ] Signed URL helper TODO (`lib/images.ts`)
- [ ] Legacy NSFW/suspicious analysis TODO helpers (`lib/images.ts`)
- [ ] Legacy ZIP export helper TODO (`lib/images.ts`)
- [ ] Legacy storage usage helper TODO (`lib/images.ts`)

### Attendance UX
- [ ] Organizer QR scanner still runs demo/mock scan flow (`components/attendance/OrganizerQRScanner.tsx`)

## Test Coverage Status

Last run: 2026-02-14

### Passing Suites
- `lib/rate-limit.test.ts`
- `lib/upload/validator.test.ts`
- `lib/upload/image-processor.test.ts`
- `lib/recaptcha.test.ts`

### Coverage Gaps (Verified by file inventory + trackers)
- [ ] Component tests for admin/organizer dashboard surfaces
- [ ] API integration tests for critical endpoints
- [ ] E2E coverage for core user flows

## Documentation Drift Notes

### Confirmed Drift
- Historical progress docs reference `lib/websocket/server.ts`, but that file does not exist.
- Current realtime implementation is Supabase client-based (`lib/realtime/client.tsx`); older historical notes still reference Socket.io/WebSocket framing.

### Resolved Drift (2026-02-19)
- `docs/README.md` runtime command mismatch (`dev:all`) fixed to `npm run dev`.
- `docs/README.md` realtime and middleware/proxy references aligned with current codebase.
- `.env.example` now includes `SENTRY_DSN` alongside public Sentry DSN for consistency with runtime config.

### Rule
When progress docs conflict with code/runtime behavior, code and `package.json` are authoritative.

## Prioritized Next Steps (P0/P1/P2)

### P0 (Security and Correctness)
1. Implement tenant-backed reCAPTCHA and moderation configuration loading (`lib/recaptcha.ts`, `lib/moderation/auto-moderate.ts`).

### P1 (Reliability and Consistency)
1. Resolve legacy TODO stubs in `lib/images.ts` or migrate all call sites to maintained modules.
2. Standardize API error response and logging patterns across critical routes.
3. Expand CI to include explicit security gate invocation in the quality workflow (`npm run security:audit` + `npm run security:snyk`).

### P2 (Quality and Maintainability)
1. Replace index-based React keys with stable IDs in identified list renders.
2. Add component tests for admin/organizer core surfaces.
3. Add API integration tests for auth, events, photos, lucky draw, and photo challenge critical paths.
4. Split remaining large hotspots (`lib/services/event-photos.ts`, guest page controller/view, lucky draw admin tab) into smaller maintainable modules.

## Change Log

- 2026-02-19: Completed production hardening pass for auth/tenant/CAPTCHA/realtime-adjacent safety; local lint/typecheck/build/tests/security gates now pass.
- 2026-02-19: Added CI quality workflow and tightened existing security workflow failure semantics.
- 2026-02-19: Added `GET /api/health` and `GET /api/auth/health` endpoints for readiness checks.
- 2026-02-19: Updated docs/runtime/env drift points (`docs/README.md`, `.env.example`) to match current code contracts.
- 2026-02-14: Completed multi-tenant login lookup and lucky-draw `createdBy` attribution/auth hardening; removed both from open gaps and P0.
- 2026-02-14: Marked photo-challenge organizer auth hardening as completed and removed it from open gaps/P0.
- 2026-02-14: Consolidated all active progress tracking into this file.
- 2026-02-14: Deprecated `TODO.md` and `docs/fix-plan.md` as non-authoritative trackers with pointers to this file.
- 2026-02-14: Normalized progress to code-verified status only; removed speculative timeline ownership from canonical tracking.
