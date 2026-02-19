# SuperAdmin System Analysis

**Project:** Galeria / Galeria
**Date:** 2026-02-02
**Version:** 1.0

---

## Table of Contents

1. [Code Layout & Architecture](#1-code-layout--architecture)
2. [What SuperAdmin Can Do](#2-what-superadmin-can-do)
3. [What SuperAdmin Can See](#3-what-superadmin-can-see)
4. [Potential Improvements](#4-potential-improvements)
5. [Priority Recommendations](#5-priority-recommendations)

---

## 1. Code Layout & Architecture

### File Structure

```
app/admin/
├── layout.tsx          # Main admin layout with sidebar navigation
├── page.tsx            # Dashboard with stats & activity feed
├── users/page.tsx      # User management (CRUD, role changes)
├── events/page.tsx     # Event management view
├── settings/page.tsx   # System-wide settings
└── profile/page.tsx    # Admin profile management

app/api/admin/
├── stats/route.ts          # System statistics
├── users/route.ts          # User listing & search
├── users/[userId]/route.ts # User update/delete
├── activity/route.ts       # Recent activity feed
├── moderation/route.ts     # AI moderation settings
└── profile/route.ts        # Profile update

lib/
├── auth.ts            # JWT, password hashing, role checks
└── types.ts           # TypeScript definitions

middleware/
└── auth.ts            # Authentication middleware
```

### Key Files Reference

| File | Purpose | Key Functions |
|------|---------|---------------|
| `app/admin/layout.tsx` | Protected admin layout with sidebar | Role check, navigation, user menu |
| `app/admin/page.tsx` | Dashboard overview | Stats display, activity feed |
| `app/admin/users/page.tsx` | User management UI | List, search, role/tier changes, delete |
| `app/api/admin/stats/route.ts` | System statistics API | `GET /api/admin/stats` |
| `app/api/admin/users/route.ts` | Users API | `GET /api/admin/users` |
| `app/api/admin/users/[userId]/route.ts` | Individual user API | `PATCH`, `DELETE` |
| `app/api/admin/activity/route.ts` | Activity feed API | `GET /api/admin/activity` |
| `app/api/admin/moderation/route.ts` | Moderation settings | `GET`, `PATCH`, `POST` (test) |
| `lib/auth.ts` | Auth utilities | `isSuperAdmin()`, `requireAuthForApi()` |
| `middleware/auth.ts` | Auth middleware | `requireSuperAdmin()`, `requireRole()` |

### Authentication Flow

```
Request
    ↓
Middleware (authMiddleware)
    ↓
Validate session (cookie or header)
    ↓
Attach headers (x-user-id, x-user-role, x-tenant-id, x-session-id)
    ↓
API Route: requireSuperAdmin()
    ↓
Check role === 'super_admin'
    ↓
Return user/session or 403/401
```

### Authorization Patterns

**Role Checking** (`lib/auth.ts:352-354`)
```typescript
export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
}
```

**Middleware Helper** (`middleware/auth.ts:384-388`)
```typescript
export async function requireSuperAdmin(
  request: NextRequest
): Promise<{ user: IUser; session: ISessionData } | NextResponse> {
  return requireRole(request, ['super_admin']);
}
```

**Frontend Protection** (`app/admin/layout.tsx:38-42`)
```typescript
useEffect(() => {
  if (!isLoading && (!isAuthenticated || user?.role !== 'super_admin')) {
    router.push('/auth/admin/login');
  }
}, [isLoading, isAuthenticated, user, router]);
```

---

## 2. What SuperAdmin Can Do

| Feature | Description | API Endpoint |
|---------|-------------|--------------|
| **Dashboard** | View total users, events, photos, active events, recent activity | `GET /api/admin/stats` |
| **User Management** | List/search users, change roles, change subscription tiers, delete users | `GET/PATCH /api/admin/users` |
| **User Actions** | Update individual user role or tier, delete user | `PATCH/DELETE /api/admin/users/[userId]` |
| **Event Management** | View all events, filter by status, delete events, link to organizer view | `GET /api/events` (superadmin access) |
| **Settings** | Configure upload limits, AWS Rekognition moderation, default event themes/features | `GET/PATCH /api/admin/settings` |
| **Moderation** | Configure AI content moderation, test AWS connection | `GET/PATCH/POST /api/admin/moderation` |
| **Profile** | Update name/password | `PATCH /api/admin/profile` |
| **Activity Feed** | View recent registrations, events created, photos uploaded, moderation actions | `GET /api/admin/activity` |

### Available Actions

#### User Management
- View all users across tenants
- Search by name or email
- Filter by role (guest, organizer, super_admin)
- Change user role (dropdown)
- Change subscription tier (free, pro, premium, enterprise, tester)
- Delete users (with self-deletion protection)

#### Event Management
- View all events with status badges
- Filter by status (draft, active, ended, archived)
- Link to organizer event admin view
- Delete events

#### System Settings
- **Upload Settings**
  - Max file size (MB)
  - Allowed file types (JPEG, PNG, HEIC, WEBP)
- **AI Moderation**
  - Enable/disable moderation
  - AWS region selection
  - Confidence threshold slider (50-99%)
  - Auto-reject toggle
  - AWS credentials (masked display)
- **Default Event Theme**
  - Primary/secondary colors
  - Background color
  - Frame template
  - Photo card style
- **Default Event Features**
  - Photo upload, lucky draw, reactions
  - Moderation required
  - Anonymous allowed
  - Guest download enabled

---

## 3. What SuperAdmin Can See

| Data | Visibility | Notes |
|------|------------|-------|
| **All Users** | Email, name, role, tier, created_at, last_login_at | Cross-tenant access |
| **All Events** | Name, status, date, organizer, photo count | Cross-tenant access |
| **All Photos** | Via activity feed (with thumbnails) | Indirect access |
| **System Stats** | Total users, events, photos, tenants, active events, recent users | Aggregated counts |
| **Activity Logs** | User registrations, events created, photos uploaded, moderation actions | With timestamps |
| **AWS Credentials** | Masked (last 4 chars visible) | `***xxxx` format |
| **Tenant Info** | Company name (via activity feed) | Limited exposure |

### Data Access Examples

**User Data** (`app/api/admin/users/route.ts:44-48`)
```sql
SELECT id, email, name, role, tenant_id, subscription_tier, created_at, last_login_at
FROM users
WHERE {conditions}
ORDER BY created_at DESC
```

**Activity Feed** (`app/api/admin/activity/route.ts`)
- User registrations with tenant company name
- Event creations with organizer and status
- Photo uploads with contributor and event
- Moderation actions with moderator and reason

---

## 4. Potential Improvements

### 🔴 Security Concerns (P0-P1)

#### 1. No Audit Logging
**Location:** All `app/api/admin/*` routes

**Issue:** Critical admin actions (role changes, user deletion) are not logged to an audit table.

**Impact:** Cannot track who did what, when - compliance and security issue.

**Recommendation:**
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Missing MFA/2FA
**Location:** `lib/auth.ts`

**Issue:** Superadmin accounts do not require multi-factor authentication.

**Impact:** Compromised password = full system access.

**Recommendation:** Add TOTP (Time-based One-Time Password) or hardware key (WebAuthn) support for superadmin role.

#### 3. Self-Deletion Prevention Only in DELETE
**Location:** `app/api/admin/users/[userId]/route.ts:105-109`

**Issue:** Can demote own role from super_admin, locking yourself out.

```typescript
// Current: Only prevents self-deletion
if (userId === auth.user.id) {
  return NextResponse.json(
    { error: 'Cannot delete yourself', code: 'FORBIDDEN' },
    { status: 403 }
  );
}
```

**Recommendation:**
```typescript
// Add in PATCH route
if (userId === auth.user.id && role !== undefined && role !== 'super_admin') {
  return NextResponse.json(
    { error: 'Cannot demote yourself', code: 'FORBIDDEN' },
    { status: 403 }
  );
}
```

#### 4. No Session Management
**Location:** N/A (not implemented)

**Issue:** Cannot view active sessions or force logout specific sessions.

**Impact:** If admin account compromised, cannot revoke individual sessions.

**Recommendation:** Add `/api/admin/sessions` endpoint to:
- List all active sessions for a user
- Revoke specific session by ID
- Revoke all sessions except current

#### 5. SQL Injection Risk in Users Route
**Location:** `app/api/admin/users/route.ts:37`

```typescript
if (search) {
  whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
  params.push(`%${search}%`);
  paramIndex++;
}
```

**Issue:** Same parameter index used twice - both ILIKE clauses use the same parameter value.

**Impact:** While not exploitable for injection (search value is parameterized), the query logic is broken.

**Fix:**
```typescript
if (search) {
  whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})`;
  params.push(`%${search}%`, `%${search}%`);
  paramIndex += 2;
}
```

### 🟡 Functionality Gaps (P2-P3)

#### 6. No Tenant Management
**Location:** N/A

**Issue:** Cannot create/suspend tenants or view tenant details (subscription, limits, branding).

**Recommendation:** Add `/admin/tenants` page with:
- Tenant list with status badges
- Create new tenant
- Suspend/activate tenant
- View tenant subscription and limits
- View tenant usage metrics

#### 7. No Bulk Operations
**Location:** `app/admin/users/page.tsx`

**Issue:** Cannot bulk delete users, bulk change roles, or export user lists.

**Recommendation:**
- Add checkbox column to user table
- Add bulk action dropdown (Change Role, Delete, Export CSV)
- Show selected count and confirmation dialog

#### 8. Missing Event Details in Admin View
**Location:** `app/admin/events/page.tsx`

**Issue:** Only shows basic info (name, status, date) - no photo preview, guest count, or storage usage.

**Recommendation:** Add expanded row or modal with:
- Event description
- Photo count with thumbnail grid
- Guest count
- Storage usage
- Quick links to event gallery, lucky draw, settings

#### 9. No Analytics/Reporting
**Location:** `app/admin/page.tsx`

**Issue:** Dashboard shows only current counts - no trends, growth charts, or insights.

**Recommendation:** Add:
- User registration chart (last 30 days)
- Event creation trends
- Photo upload trends
- Storage usage over time
- Popular features usage
- Tier distribution pie chart

#### 10. Limited Search Capabilities
**Location:** `app/api/admin/users/route.ts:36-40`

**Issue:** Users search only checks name/email (ILIKE). No tenant filtering, date range, or tier filters.

**Recommendation:** Add filters for:
- Tenant (dropdown)
- Subscription tier (multiselect)
- Date range (created_at)
- Last login date range
- Email verification status

### 🟢 Code Quality Issues (P2-P3)

#### 11. Duplicate Code Pattern
**Location:** `app/api/admin/users/route.ts:26-49`

**Issue:** Query building logic repeated across routes.

**Recommendation:** Extract to shared utility:
```typescript
// lib/query-builder.ts
export function buildWhereClause(conditions: {
  role?: string;
  search?: string;
  tenantId?: string;
  // ...
}): { clause: string; params: unknown[] }
```

#### 12. Hardcoded Tenant ID
**Location:** `app/api/admin/stats/route.ts:9`

```typescript
const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
```

**Issue:** System tenant ID hardcoded in multiple files.

**Recommendation:**
```typescript
// lib/config.ts
export const SYSTEM_TENANT_ID = process.env.SYSTEM_TENANT_ID || '00000000-0000-0000-0000-000000000000';
```

#### 13. Client-Side Role Checks
**Location:** `app/admin/layout.tsx:38-42`

**Issue:** Frontend redirects are bypassable (always pair with server-side checks).

**Status:** ✓ Server-side checks already present via `requireSuperAdmin()` middleware

**Note:** This is actually correct - defense in depth.

#### 14. No Loading States for Row Actions
**Location:** `app/admin/users/page.tsx:75-92`

**Issue:** Individual role/tier changes don't show loading state.

**Recommendation:** Add per-row loading state:
```typescript
const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set());

const handleRoleChange = async (userId: string, newRole: string) => {
  setLoadingRows(prev => new Set(prev).add(userId));
  // ... api call
  setLoadingRows(prev => {
    const next = new Set(prev);
    next.delete(userId);
    return next;
  });
};
```

#### 15. Toast Notifications Only
**Location:** All admin pages

**Issue:** Errors shown via toast but not logged to error tracking service.

**Recommendation:** Integrate Sentry or similar:
```typescript
try {
  // ...
} catch (error) {
  Sentry.captureException(error);
  toast.error('Failed to update user');
}
```

### 🔵 UX Improvements (P3)

#### 16. No Confirmation on Critical Actions
**Location:** `app/admin/users/page.tsx:242`

**Issue:** Role change dropdown has no confirmation - instant change.

**Recommendation:** Add confirmation dialog for:
- Role changes (especially to/from super_admin)
- Tier changes
- User deletion (already has `confirm()` - upgrade to modal)

#### 17. Missing Empty State Guidance
**Location:** `app/admin/users/page.tsx:201-205`, `app/admin/events/page.tsx`

**Issue:** When no users/events, just shows icon with "No X found".

**Recommendation:** Add helpful actions:
- "Create first user" button
- "Import users" link
- Reason for empty state explanation

#### 18. No Keyboard Shortcuts
**Location:** All admin pages

**Issue:** Power users cannot navigate quickly.

**Recommendation:** Add keyboard shortcuts:
- `?` - Show keyboard shortcuts modal
- `Ctrl+K` - Focus search
- `N` - New user/event
- `Escape` - Close modal/drawer

#### 19. Pagination UX
**Location:** `app/admin/users/page.tsx:292-311`

**Issue:** No "Jump to page" input for large datasets.

**Recommendation:** Add page number input:
```tsx
<input
  type="number"
  min={1}
  max={totalPages}
  value={currentPage}
  onChange={(e) => setCurrentPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value))))}
/>
```

#### 20. Mobile Responsiveness
**Location:** `app/admin/layout.tsx:59`

**Issue:** Sidebar is fixed width (256px), may break on mobile.

**Recommendation:** Add collapsible sidebar or bottom navigation for mobile:
```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);

// Mobile: hamburger menu
// Desktop: always visible sidebar
```

---

## 5. Priority Recommendations

| Priority | Issue | File | Impact | Effort |
|----------|-------|------|--------|--------|
| **P0** | SQL injection bug | `app/api/admin/users/route.ts:37` | Security | Low |
| **P0** | Add audit logging | New file | Security/Compliance | Medium |
| **P1** | Add self-demotion protection | `app/api/admin/users/[userId]/route.ts` | Prevent lockout | Low |
| **P1** | Add MFA for superadmin | `lib/auth.ts`, new files | Security | High |
| **P2** | Tenant management page | New `app/admin/tenants/page.tsx` | Feature completeness | Medium |
| **P2** | Session management | New `app/api/admin/sessions/route.ts` | Security oversight | Medium |
| **P3** | Bulk operations | `app/admin/users/page.tsx` | Efficiency | Medium |
| **P3** | Analytics dashboard | `app/admin/page.tsx` | Business insights | High |

### Implementation Order

1. **Week 1 (Security Fixes)**
   - Fix SQL injection bug
   - Add self-demotion protection
   - Implement audit logging

2. **Week 2-3 (Security Hardening)**
   - Add MFA support
   - Implement session management
   - Add rate limiting to admin routes

3. **Week 4-5 (Feature Completeness)**
   - Build tenant management page
   - Add bulk operations
   - Enhanced search filters

4. **Week 6+ (Enhancements)**
   - Analytics dashboard
   - UX improvements
   - Mobile responsiveness

---

## Appendix

### Role Hierarchy

```
super_admin  ← Can see/do everything across tenants
    ↓
organizer    ← Can manage own events
    ↓
guest        ← Can upload photos, view events
```

### Type Definitions

**UserRole** (`lib/types.ts:111`)
```typescript
export type UserRole = 'guest' | 'organizer' | 'super_admin';
```

**SubscriptionTier** (`lib/types.ts:13`)
```typescript
export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise' | 'tester';
```

### Environment Variables Needed

```env
# System
SYSTEM_TENANT_ID=00000000-0000-0000-0000-000000000000

# JWT (for superadmin sessions)
JWT_ACCESS_SECRET=xxx
JWT_REFRESH_SECRET=xxx
JWT_ACCESS_EXPIRES=900
JWT_REFRESH_EXPIRES=604800

# AWS (for moderation - optional)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
```

---

*Document generated: 2026-02-02*
*For questions or updates, contact the development team*
