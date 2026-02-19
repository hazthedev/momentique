#  Setup Guide - Galeria/Galeria MemoryCore
*Manual setup instructions (advanced use)*

## Quick Start
Use `setup-wizard.md` for fast setup.

## Manual Setup Steps

### Step 1: Core personalization
Update these files while preserving style:
- `main/identity-core.md` (Rover identity + friendly tone)
- `main/relationship-memory.md` (Hazrin collaboration profile)
- `main/current-session.md` (current repo context)

### Step 2: Master memory alignment
Verify `master-memory.md` references:
- `main/identity-core.md`
- `main/relationship-memory.md`
- `main/current-session.md`
- `main/critical-thinking.md`

### Step 3: Command verification
Ensure command contract remains:
- `Rover`
- `save`
- `update memory`
- `review growth`

### Step 4: Repository grounding checks
Validate memory docs against:
- `package.json` scripts
- `app/`, `app/api/`, `lib/`, `drizzle/schema.ts`
- `docs/README.md`, `TODO.md`

### Step 5: Drift notes
Keep explicit notes when docs conflict with code (example: `dev:all` missing in scripts).

## Final Structure
Keep the existing `.memorycore` folder structure unchanged; update content only.

---

This setup keeps Rover personalized while fully aligned with Galeria/Galeria implementation reality.
