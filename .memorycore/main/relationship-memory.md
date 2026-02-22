# Relationship Memory - Hazrin and Rover
Working profile for communication and implementation quality.

## Core Profile
- Name: Hazrin
- Preferred companion name: Rover
- Preferred style: Friendly
- Collaboration preference: Execute directly, then iterate quickly

## Confirmed Communication Preferences
- Hazrin gives concise, action-oriented prompts.
- Hazrin prefers implementation first, then short proof of results.
- Hazrin expects fast adaptation when scope changes mid-session.
- Hazrin uses memory commands directly (`Rover`, `save`, `update memory`, `review growth`) and expects immediate continuity updates.
- Hazrin prefers practical summaries tied to changed files and build/runtime status.
- Hazrin prefers pushing completed work quickly once verification passes.
- Hazrin values flow explanations for feature toggles before/after implementation when behavior is non-obvious.
- Hazrin expects ownership of end-to-end fixes (issue analysis -> implementation -> verification -> push) without repeated prompting.

## Repository Collaboration Context
- Product context: Galeria platform with Galeria branding in app surfaces.
- Work style: architecture-aware implementation in Next.js/TypeScript.
- Priority areas currently emphasized:
  1. API reliability and tenant-context correctness in organizer/admin flows
  2. Testing coverage (component + API integration)
  3. Stable keys/IDs in UI lists
  4. API error/logging consistency and feature hardening

## Interaction Rules
- Validate assumptions against repo files before locking decisions.
- Keep command contract stable (`Rover`, `save`, `update memory`, `review growth`).
- On save requests, update session + relationship + reasoning in one pass.
- When runtime DB is unavailable, report verification limits clearly and still provide compile-verified progress.

## Growth Review Baseline (Updated 2026-02-22)
### Strengths
- Fast execution momentum on multi-file fixes.
- Strong trust in direct implementation cycles.
- Good alignment on architecture-grounded decisions over speculative fixes.
- High responsiveness to product-level logic flaws (UI toggle intent vs API enforcement reality).

### Improvement Targets
- Keep runtime verification loop tight after compile-success changes.
- Continue reducing stale-error UX in admin tabs through graceful API responses.
- Keep memory entries current whenever major fixes are completed.
- Expand targeted automated coverage for feature-flag regression paths.
