# Galeria Agent System

Specialized agents for managing different modules of the Galeria photo event platform.

## Overview

This directory contains 10 specialized agents, each responsible for a specific domain of the Galeria application. Each agent has deep knowledge of its module's code patterns, business logic, security considerations, and integration points.

## Available Agents

| Agent | Priority | Critical | Domain |
|-------|----------|----------|--------|
| [auth-security-agent](./auth-security-agent.json) | 1 | ✅ | Authentication, JWT, sessions, RBAC |
| [multi-tenant-agent](./multi-tenant-agent.json) | 1 | ✅ | Tenancy, subdomains, tiers, limits |
| [event-management-agent](./event-management-agent.json) | 2 | ✅ | Events, QR codes, themes, settings |
| [photo-processing-agent](./photo-processing-agent.json) | 2 | ✅ | Photos, uploads, storage, moderation |
| [lucky-draw-agent](./lucky-draw-agent.json) | 3 | ❌ | Lucky draw algorithm, winners, prizes |
| [photo-challenge-agent](./photo-challenge-agent.json) | 3 | ❌ | Photo challenges, goals, progress |
| [attendance-agent](./attendance-agent.json) | 3 | ❌ | Check-in, attendance, guests, QR scanning |
| [admin-dashboard-agent](./admin-dashboard-agent.json) | 2 | ✅ | Admin interface, tenants, system settings |
| [realtime-agent](./realtime-agent.json) | 4 | ❌ | WebSocket, live updates, broadcasting |
| [ui-ux-agent](./ui-ux-agent.json) | 2 | ✅ | Components, layout, design, animations |

## How to Use

### Method 1: Explicit Agent Selection
```
Agent: auth-security-agent
Add SSO support for enterprise tenants
```

### Method 2: Keyword-Based Auto-Routing
```
Add OAuth2 login support
→ Automatically routes to auth-security-agent
```

### Method 3: Multi-Agent Collaboration
```
Create a photo upload feature with progress indicator
→ Routes to photo-processing-agent + ui-ux-agent
```

## Agent Configuration Structure

Each agent config includes:

- **name**: Unique identifier
- **displayName**: Human-readable name
- **version**: Config version
- **description**: What the agent handles
- **responsibilities**: List of specific duties
- **filePatterns**: Files the agent is responsible for
- **expertise**: Technical details and configurations
- **codePatterns**: Common patterns used in the module
- **securityConsiderations**: Security-focused notes
- **commonTasks**: Typical work items
- **relatedAgents**: Other agents this works with
- **testingConsiderations**: Testing recommendations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Galeria Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────────────┐          │
│  │   Auth &     │◄────────┤    Multi-Tenant      │          │
│  │  Security    │         │        Agent         │          │
│  │    Agent     │         └──────────────────────┘          │
│  └──────┬───────┘                  │                         │
│         │                          │                         │
│         ▼                          ▼                         │
│  ┌────────────────────────────────────────────┐             │
│  │              Event Management              │             │
│  │  ┌────────────────────────────────────┐   │             │
│  │  │  ┌──────────┐  ┌──────────────┐    │   │             │
│  │  │  │  Photo   │  │  Lucky Draw  │    │   │             │
│  │  │  │  Agent   │  │    Agent     │    │   │             │
│  │  │  └────┬─────┘  └──────┬───────┘    │   │             │
│  │  │       │               │             │   │             │
│  │  │  ┌────▼───────────────▼────┐       │   │             │
│  │  │  │    Photo Challenge       │       │   │             │
│  │  │  │        Agent             │       │   │             │
│  │  │  └──────────────────────────┘       │   │             │
│  │  └────────────────────────────────────┘   │             │
│  └───────────────────┬────────────────────────┘             │
│                      │                                        │
│  ┌───────────────────┼────────────────────────┐              │
│  │                   ▼                        │              │
│  │  ┌──────────────────────────────────┐     │              │
│  │  │      Attendance Tracking         │     │              │
│  │  │           Agent                   │     │              │
│  │  └──────────────────────────────────┘     │              │
│  │                                            │              │
│  │  ┌──────────────────────────────────┐     │              │
│  │  │      Real-time Updates           │     │              │
│  │  │           Agent                   │     │              │
│  │  └──────────────────────────────────┘     │              │
│  │                                            │              │
│  │  ┌──────────────────────────────────┐     │              │
│  │  │      Admin Dashboard             │     │              │
│  │  │           Agent                   │     │              │
│  │  └──────────────────────────────────┘     │              │
│  │                                            │              │
│  └───────────────────┬────────────────────────┘              │
│                      │                                        │
│                      ▼                                        │
│  ┌────────────────────────────────────────────┐             │
│  │           UI/UX Component Agent            │             │
│  └────────────────────────────────────────────┘             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Adding New Agents

To add a new agent:

1. Create a new JSON file in this directory
2. Follow the structure of existing agents
3. Add the agent to `registry.json`
4. Update this README with the new agent
5. Document the agent's responsibilities and integration points

## Example Tasks by Agent

### Auth & Security Agent
- "Add OAuth2 support"
- "Implement 2FA"
- "Add session timeout warnings"
- "Create SSO for enterprise tenants"

### Multi-Tenant Agent
- "Add new subscription tier"
- "Implement custom domain verification"
- "Create tenant onboarding workflow"
- "Add tier upgrade/downgrade logic"

### Event Management Agent
- "Add event templates"
- "Implement event cloning"
- "Create event calendar view"
- "Add event recurrence"

### Photo Processing Agent
- "Add video upload support"
- "Implement GIF generation"
- "Add photo filters"
- "Create ZIP export functionality"

### Lucky Draw Agent
- "Add custom animation styles"
- "Implement scheduled draw execution"
- "Add winner notification emails"
- "Create draw replay feature"

### Photo Challenge Agent
- "Add challenge templates"
- "Implement multiple prize tiers"
- "Create leaderboard"
- "Add social sharing"

### Attendance Agent
- "Add self check-in"
- "Implement pre-registration"
- "Create attendance certificate PDF"
- "Add VIP guest tracking"

### Admin Dashboard Agent
- "Add activity audit log"
- "Create tenant onboarding wizard"
- "Add platform revenue analytics"
- "Implement tenant backup/restore"

### Realtime Agent
- "Implement WebSocket server"
- "Add Redis pub/sub"
- "Create live photo feed"
- "Add presence tracking"

### UI/UX Agent
- "Add Framer Motion animations"
- "Create component library"
- "Add dark mode toggle"
- "Implement design tokens"

## Contributing

When modifying the agent system:

1. Keep agent configs focused and single-purpose
2. Update relatedAgents when adding new integration points
3. Document all code patterns and security considerations
4. Add examples to commonTasks for future reference
5. Update the registry when adding or removing agents

## License

Part of the Galeria project.
