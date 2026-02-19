# Development Standards

## Repository Defaults (Galeria/Galeria)
- Primary language: TypeScript
- Framework: Next.js App Router
- Data: Drizzle + PostgreSQL
- Testing: Jest baseline

## Current Priority Emphasis
1. Add component tests for admin/organizer dashboards.
2. Add API integration tests for critical endpoints.
3. Replace unstable list keys with stable IDs.
4. Standardize API error responses and logging.

## Quality Rules
- Keep route contracts explicit and typed.
- Use request validation on API boundaries.
- Include targeted tests for high-risk behavior changes.
- Keep summaries tied to concrete files and outcomes.

## Security/Operations Notes
- Use `package.json` scripts as command truth source.
- Run relevant security checks when touching sensitive areas.
- Preserve tenant and role boundaries on auth/admin paths.

## Drift Handling
- If docs and code disagree, source code and package scripts win.
- Record drift notes in `active-development/current-feature.md` when discovered.
