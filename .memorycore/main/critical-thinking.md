# Critical Thinking Core - Rover

## Purpose
Capture reusable engineering reasoning patterns relevant to Galeria/Galeria implementation work.

## Reasoning Framework
1. Define objective and constraints.
2. Confirm ground truth in repo files.
3. List options with tradeoffs.
4. Implement minimal-risk path.
5. Validate with targeted checks.
6. Record reusable lessons.

## Reusable Patterns (Current)
- Validate product/domain assumptions against `app/`, `app/api/`, and `lib/` before planning.
- Treat `package.json` scripts as command source of truth.
- Record documentation drift explicitly when docs and runtime differ.
- Keep schema/API/type changes coordinated (`drizzle/schema.ts`, route handlers, `lib/types.ts`).
- For high-risk behavior changes, pair implementation with focused tests.
- For memory cleanup tasks, preserve naming/style while replacing stale factual context.

## Multi-tenant API Reliability Patterns
- For optional/public read routes, resolve tenant context in this order:
  1. authenticated session/JWT tenant
  2. request `x-tenant-id` header
  3. `DEFAULT_TENANT_ID`
- Use non-throwing optional auth resolution for read endpoints to avoid hard failures.
- Keep strict auth checks on mutation routes, but allow safe read fallbacks where product behavior supports it.

## Graceful Degradation Patterns
- For dashboard/statistics endpoints, avoid all-or-nothing query blocks.
- Prefer `Promise.allSettled` for independent metrics so one query failure does not blank the entire page.
- Return additive warnings (`warnings`) with successful payloads for partial data states.
- Treat recoverable DB drift errors (`42P01`, `42703`) as safe-empty responses on non-critical GET endpoints.

## Feature Toggle Enforcement Patterns
- Treat settings toggles as dual-surface contracts:
  1. UI must communicate disabled state clearly.
  2. APIs must enforce disabled state regardless of UI path.
- Preserve partial/missing settings semantics by blocking only when feature flag is explicitly `false`.
- Use a shared gate helper to avoid route-level drift and to standardize payloads (`code: FEATURE_DISABLED`).
- Keep `EVENT_NOT_FOUND` precedence ahead of feature-disabled checks where applicable.
- In admin surfaces, prefer actionable remediation UX: disabled callout + deep-link to `Settings > Features`.

## Debugging and Verification Patterns
- Use `rg` for fast codebase discovery.
- Prefer narrow verification commands over broad noisy runs.
- Verify no stale context remains with targeted keyword scans.
- After major doc rewrites, run consistency checks for command contract and alias pointers.
- If runtime dependencies are unavailable, complete compile verification (`npm run build`) and record runtime check as explicit follow-up.

## Update Rule
Update this file only when a pattern is broadly reusable across future sessions.
