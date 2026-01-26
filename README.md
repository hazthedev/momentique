# Momentique

**Multi-tenant event photo management platform with real-time features**

Momentique is a white-label SaaS platform that allows event organizers to create photo galleries where guests can upload, view, and interact with photos. Features include real-time updates, lucky draws, and multi-tenant architecture with Row-Level Security.

## Features

- **Multi-Tenant Architecture**: Complete tenant isolation with Row-Level Security (RLS)
- **Photo Management**: Upload, moderate, and organize event photos
- **Lucky Draw**: Engage guests with random winner selection
- **Real-Time Updates**: Live photo updates via WebSocket
- **Secure**: JWT authentication, RLS policies, bcrypt password hashing
- **Analytics**: Track engagement and usage metrics
- **Customizable**: Tenant branding, themes, and feature flags

## Quick Start

Get up and running in 3 commands:

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL and Redis (Docker)
npm run db:setup

# 3. Start the development server + WebSocket server
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### With Sample Data

To populate the database with sample data for development:

```bash
npm run db:setup
npm run db:seed    # Creates sample tenant, users, events, and photos
npm run dev:all
```

**Admin credentials** (from seed data):
- Email: `admin@acme.com`
- Password: `password123`

## Environment Variables

Create a `.env` file in the project root (see `.env.example` for reference):

### Database

```bash
DATABASE_URL=postgresql://momentique:password@localhost:5432/momentique
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
```

### Redis

```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
```

### Authentication

```bash
JWT_ACCESS_SECRET=your-super-secret-access-token-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-min-32-chars
JWT_ACCESS_EXPIRES=900
JWT_REFRESH_EXPIRES=604800
```

### Storage (Cloudflare R2 / AWS S3)

```bash
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=momentique-dev
R2_PUBLIC_URL=https://pub-xxxxxxxxx.r2.dev
```

## Database Commands

```bash
npm run db:setup        # Start Docker containers + run migrations
npm run db:reset        # Drop all tables + migrate + seed (dev only!)
npm run db:migrate      # Run pending migrations
npm run db:rollback     # Rollback migrations
npm run db:seed         # Seed development data
npm run db:seed:test    # Seed test data (CI/CD)
npm run db:health       # Check database connectivity
npm run db:studio       # Open Drizzle Studio (DB browser)
npm run db:generate     # Generate new migration from schema
npm run db:push         # Push schema changes (dev only)
npm run db:backup       # Create timestamped backup
npm run db:restore      # Restore from backup
```

## Docker Commands

```bash
npm run docker:up       # Start all containers
npm run docker:down     # Stop all containers
npm run docker:logs     # Follow container logs
npm run docker:ps       # Show container status
```

## Multi-Tenancy Architecture

Momentique uses **Row-Level Security (RLS)** for complete tenant isolation at the database level.

### How It Works

1. **Tenant Resolution**: Middleware extracts tenant from domain/subdomain
2. **Context Setting**: `TenantDatabase.query()` calls `set_tenant_id(tenantId)` before each query
3. **RLS Enforcement**: PostgreSQL policies filter rows based on `current_tenant_id()`
4. **Automatic Isolation**: All queries automatically scoped to tenant context

### Security Layers

```
Application (Next.js)
       ↓
Middleware (tenant injection)
       ↓
API Routes (tenant validation)
       ↓
TenantDatabase (set_tenant_id())
       ↓
PostgreSQL RLS Policies (enforced)
```

### Critical Components

- **`set_tenant_id(UUID)`**: Sets session context for RLS
- **`current_tenant_id()`**: Returns current tenant from session
- **RLS Policies**: Database-level filters on all tenant tables
- **TenantDatabase Class**: Wraps queries with tenant context

### Tenant Isolation Testing

```sql
-- Set tenant context
SELECT set_tenant_id('11111111-1111-1111-1111-111111111111');

-- Query (automatically scoped to tenant)
SELECT * FROM users;  -- Only returns users from this tenant

-- Switch tenant
SELECT set_tenant_id('22222222-2222-2222-2222-222222222222');
SELECT * FROM users;  -- Only returns users from different tenant
```

## Adding a New Migration

When modifying the database schema:

1. **Update Drizzle Schema** (`drizzle/schema.ts`):
   ```typescript
   export const users = pgTable('users', {
     // ... existing fields
     newField: text('new_field'),
   });
   ```

2. **Generate Migration**:
   ```bash
   npm run db:generate
   ```

3. **Review Generated SQL** (`drizzle/migrations/`):
   - Check the generated migration file
   - Add custom SQL if needed (e.g., RLS policies)

4. **Apply Migration**:
   ```bash
   npm run db:migrate
   ```

5. **Test**:
   ```bash
   npm run db:health
   npm run db:studio  # Verify changes in database browser
   ```

## Troubleshooting

### Database Connection Issues

**Problem**: `connection refused` or `ECONNREFUSED`

**Solutions**:
```bash
# Check if Docker containers are running
npm run docker:ps

# Restart Docker containers
npm run docker:down
npm run docker:up

# Check PostgreSQL logs
docker-compose logs postgres

# Verify database is accessible
npm run db:health
```

### Migration Issues

**Problem**: Migration fails with error

**Solutions**:
```bash
# Check current migration version
psql -d momentique -c "SELECT * FROM migration_version"

# Run specific migration manually
psql -d momentique -f drizzle/migrations/0001_xxx.sql

# Reset database (dev only - deletes all data!)
npm run db:reset
```

### RLS Not Working

**Problem**: Can see data from other tenants

**Solutions**:
```sql
-- Check RLS is enabled
SELECT tablename, relrowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'events', 'photos');

-- Check policies exist
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Verify set_tenant_id function exists
SELECT proname FROM pg_proc WHERE proname = 'set_tenant_id';
```

### Port Already in Use

**Problem**: PostgreSQL port 5432 already in use

**Solutions**:
```bash
# Change port in .env
POSTGRES_PORT=5433

# Or stop existing PostgreSQL
# Windows: Stop PostgreSQL service in Services
# Mac: brew services stop postgresql
# Linux: sudo systemctl stop postgresql
```

### Permission Issues (Windows)

**Problem**: Docker volume permission errors

**Solutions**:
- Use named volumes (already configured in `docker-compose.yml`)
- Run Docker Desktop as administrator
- Check Docker Desktop file sharing settings

## Development Workflow

### Making Schema Changes

1. Modify `drizzle/schema.ts`
2. Run `npm run db:generate`
3. Review generated migration in `drizzle/migrations/`
4. Run `npm run db:migrate`
5. Test with `npm run db:studio`

### Adding New Features

1. Create feature branch: `git checkout -b feature/new-feature`
2. Implement feature with TypeScript types in `lib/types.ts`
3. Add API routes in `app/api/`
4. Update database schema if needed
5. Test with sample data
6. Run security scan: `npm run security:scan`
7. Create pull request

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run coverage report
npm run test:coverage

# Seed test data
NODE_ENV=test npm run db:seed:test
```

### Production Deployment

1. **Set Environment Variables**:
   - Configure production `DATABASE_URL`
   - Set secure `JWT_ACCESS_SECRET`
   - Configure `R2_*` variables for storage

2. **Run Migrations**:
   ```bash
   DATABASE_URL=production_db_url npm run db:migrate
   ```

3. **Build Application**:
   ```bash
   npm run build
   ```

4. **Start Application**:
   ```bash
   npm start
   ```

## Project Structure

```
momentique/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # React components
│   ├── admin/                    # Admin components
│   ├── gallery/                  # Photo gallery
│   └── lucky-draw/               # Lucky draw feature
├── drizzle/                      # Database schema & migrations
│   ├── schema.ts                 # Drizzle schema definitions
│   └── migrations/               # SQL migration files
├── scripts/                      # Database management scripts
│   ├── migrate.ts                # Run migrations
│   ├── seed-development.ts       # Development seed data
│   └── db-health.ts              # Health check script
├── lib/                          # Core utilities
│   ├── auth.ts                   # JWT authentication
│   ├── db.ts                     # TenantDatabase class
│   ├── tenant.ts                 # Multi-tenant resolution
│   └── types.ts                  # TypeScript type definitions
├── docker-compose.yml            # PostgreSQL + Redis
└── middleware.ts                 # Next.js middleware
```

## Technologies Used

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Database**: [PostgreSQL 15](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Caching**: [Redis 7](https://redis.io/)
- **Real-Time**: [Socket.io](https://socket.io/)
- **Storage**: Cloudflare R2 / AWS S3
- **Image Processing**: Sharp
- **Authentication**: JWT + bcrypt
- **Monitoring**: Sentry
- **Styling**: Tailwind CSS 4

## License

MIT

## Support

For issues and questions, please open a GitHub issue or contact the Momentique team.
