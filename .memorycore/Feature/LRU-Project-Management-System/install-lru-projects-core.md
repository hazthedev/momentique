# Install LRU Projects Core

## Goal
Initialize LRU project tracking with workstream categories relevant to Galeria/Galeria development.

## Steps
1. Ask Hazrin which project types should be enabled.
2. Create active/archived placeholders in memory records.
3. Register command mappings:
   - `new [type] project [name]`
   - `load project [name]`
   - `save project`
4. Confirm separation from core `save` command.

## Recommended Default Types
- auth-tenant
- photo-pipeline
- moderation
- lucky-draw
- attendance
- export
- subscription-usage
- platform-admin

## Verification
- `list projects` returns empty initialized structure
- `new ... project ...` creates a tracked active item
- `save project` updates only project memory records
