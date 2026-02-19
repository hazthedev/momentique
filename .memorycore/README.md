#  AI MemoryCore - Galeria/Galeria Context
*A persistent memory architecture tuned for this codebase*

##  What This Does

This MemoryCore keeps Rover consistent across sessions while grounding memory in the real architecture and priorities of the Galeria/Galeria repository.

##  Key Features

- **Persistent Memory**: Rover remembers collaboration patterns across sessions
- **Project Grounding**: Memory reflects actual code structure, APIs, and priorities
- **Session Continuity**: `main/current-session.md` works like RAM for active work
- **Protocol Commands**: `Rover`, `save`, `update memory`, `review growth`
- **Optional Extensions**: time-aware behavior, LRU project memory, Feature-Dev workflow, and Code-Size-Guardian

##  Codebase Context Snapshot

### Product Identity
- **Platform**: Galeria
- **App-facing brand in UI/code comments**: Galeria
- **Domain**: Multi-tenant event photo platform

### Architecture
- Next.js App Router + TypeScript
- PostgreSQL + Drizzle schema/migrations + RLS tenant isolation
- Redis for session/rate-limiting support
- Photo pipeline with R2/S3 and Sharp processing
- Realtime client integration via Supabase (`lib/realtime/client.tsx`)
- Moderation pipeline using Rekognition + BullMQ job processing

### Core Feature Domains
- Auth + tenant resolution + role gating
- Organizer/admin event management
- Photo upload/gallery/reactions/moderation/export
- Lucky draw config/entries/participants/history/redraw
- Photo challenge progress and prize claim verification
- Attendance check-in and QR workflows
- Subscription/usage and organizer billing surfaces

### Active Priorities
- Replace index keys with stable IDs
- Add component tests for admin/organizer dashboards
- Add API integration tests for critical routes
- Standardize API error responses and logging

##  Reality Notes (Conflict Tracking)

- `docs/README.md` references `npm run dev:all`, but `package.json` currently does **not** define `dev:all`.
- Some docs mention Socket.io, while current realtime client behavior is implemented through Supabase realtime client patterns.

##  File Structure

```text
.memorycore/
  master-memory.md
  main-memory.md
  current-session-memory.md
  critical-thinking.md
  save-protocol.md
  setup-guide.md
  setup-wizard.md
  main/
    identity-core.md
    relationship-memory.md
    critical-thinking.md
    current-session.md
    current-session-memory.md
    current-session-memory-format-template.md
  daily-diary/
    Daily-Diary-001.md
    daily-diary-protocol.md
  Feature/
    Time-based-Aware-System/
    LRU-Project-Management-System/
    Feature-Dev-System/
      feature-dev-core.md
      active-development/current-feature.md
      completed-features/
    Code-Size-Guardian-System/
      code-size-guardian-core.md
      code-size-config.md
```

##  Available Feature Extensions

### Time-based Aware System
- Adjusts session pacing by time of day.

### LRU Project Management System
- Tracks multiple active workstreams and supports project save/load.

### Feature-Dev System
- Adds a structured feature lifecycle protocol for planning, execution, testing, and completion.
- Activation commands:
  - `load feature-dev`
  - `start dev mode`
- Working state:
  - Active: `Feature/Feature-Dev-System/active-development/current-feature.md`
  - Archive: `Feature/Feature-Dev-System/completed-features/`

### Code-Size-Guardian System
- Adds guided file-size monitoring and refactor suggestion workflow.
- Activation commands:
  - `load code-size-guardian`
  - `activate size guardian`
- Module files:
  - `Feature/Code-Size-Guardian-System/code-size-guardian-core.md`
  - `Feature/Code-Size-Guardian-System/code-size-config.md`

##  Command Contract

- `Rover` -> Load memory + identity + active context
- `save` -> Persist new session learning to memory files
- `update memory` -> Refresh structured memory with latest signals
- `review growth` -> Inspect improvements and collaboration trends

---

**Version**: 3.2 (Feature-Dev + Code-Size-Guardian integrated)
**Status**: Active repository-grounded memory system
