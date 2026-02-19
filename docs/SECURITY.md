# 🔒 Galeria Security Guide

This document outlines the security measures, tools, and best practices for the Galeria project.

## 📊 Security Status

| Category | Status | Tools |
|----------|--------|-------|
| **Dependency Scanning** | ✅ Active | Snyk, npm audit |
| **Static Code Analysis** | ✅ Configured | Semgrep, ESLint Security Plugin |
| **Error Tracking** | ✅ Configured | Sentry |
| **Multi-Tenant Isolation** | ✅ Implemented | Row-Level Security (RLS) |
| **Authentication** | ✅ Implemented | JWT with refresh tokens |
| **API Security** | ✅ Implemented | Rate limiting, input validation |

---

## 🛡️ Security Tools

### 1. **Snyk** - Dependency Vulnerability Scanning

**Purpose**: Scans npm packages for known vulnerabilities

**Usage**:
```bash
# Test for vulnerabilities
npm run security:snyk

# Monitor project for ongoing updates
npm run security:snyk:monitor

# Interactive wizard to fix vulnerabilities
npm run security:fix
```

**Configuration**: `.snyk`

### 2. **Semgrep** - Static Code Analysis

**Purpose**: Finds security vulnerabilities in code through pattern matching

**Usage**:
```bash
# Run security scan
npm run security:semgrep

# Scan specific file
npx semgrep --config=.semgrep.yaml lib/auth.ts

# Auto-fix issues (where applicable)
npx semgrep --config=.semgrep.yaml --autofix
```

**Configuration**: `.semgrep.yaml`

### 3. **ESLint Security Plugin**

**Purpose**: Linting rules for security best practices

**Rules enabled**:
- Detects use of `eval()` and `Function()` constructor
- Detects unsafe regular expressions
- Detects buffer operations without validation
- Detects non-literal file system operations
- And more...

**Usage**:
```bash
npm run lint
```

**Configuration**: `eslint.config.mjs`

### 4. **Sentry** - Error Tracking & Security Monitoring

**Purpose**: Real-time error tracking, performance monitoring, and security events

**Features**:
- Error tracking with stack traces
- Session replay for debugging
- Security event monitoring
- Performance tracing
- User context capture

**Usage**:
```typescript
import { captureSecurityEvent, captureApiPerformance } from '@/sentry.config';

// Track security event
captureSecurityEvent({
  type: "auth_failure",
  severity: "medium",
  details: { ip: req.ip },
  userId: user?.id,
  tenantId: tenantId,
});

// Track API performance
captureApiPerformance("/api/events", 150, 200, { userId });
```

**Configuration**: `sentry.config.ts`

---

## 🔐 Security Best Practices

### Authentication & Authorization

1. **JWT Tokens**
   - Access tokens expire in 15 minutes
   - Refresh tokens expire in 7 days
   - Tokens are stored in HTTP-only cookies (secure)
   - RS256 algorithm for signing

2. **Password Security**
   - Bcrypt hashing with 12 salt rounds
   - Passwords never logged or exposed in errors
   - No password requirements hints in error messages

3. **Rate Limiting**
   - IP-based rate limiting
   - Browser fingerprinting for abuse prevention
   - CAPTCHA escalation after failed attempts

### Data Protection

1. **Tenant Isolation**
   - Row-Level Security (RLS) enforced in PostgreSQL
   - All queries scoped to tenant context
   - No cross-tenant data access possible

2. **Input Validation**
   - Server-side validation of all inputs
   - SQL injection prevention via parameterized queries
   - XSS prevention via React's built-in escaping

3. **Data Encryption**
   - TLS 1.3 for all connections (HTTPS only)
   - AES-256 for data at rest (S3/R2 encryption)
   - Sensitive fields encrypted in database

### File Upload Security

1. **Validation**
   - Magic number checking (not just file extension)
   - File size limits (max 10MB)
   - Format validation (JPG, PNG, HEIC, WebP only)

2. **Processing**
   - Virus scanning (ClamAV or similar)
   - Image resizing and compression
   - Metadata stripping (EXIF data removal)

3. **Storage**
   - UUID filenames (no user-provided filenames)
   - Tenant-isolated storage paths
   - CDN delivery with signed URLs

### API Security

1. **Headers**
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   X-XSS-Protection: 1; mode=block
   Content-Security-Policy: default-src 'self'
   ```

2. **CORS**
   - Whitelist allowed origins
   - No wildcard origins
   - Credentials not allowed for public endpoints

3. **Rate Limiting**
   - Auth endpoints: 5 requests/minute per IP
   - Upload endpoints: 10 requests/hour per fingerprint
   - General API: 100 requests/minute per IP

---

## 🚀 Pre-Commit & CI/CD Security

### Pre-Commit Hooks

```bash
# Run security checks before commit
npm run security:scan
```

### GitHub Actions (Recommended)

Create `.github/workflows/security.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: .semgrep.yaml

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --production
```

---

## 📋 Security Checklist

### Pre-Deployment

- [ ] Run `npm run security:scan`
- [ ] Run `npm run lint`
- [ ] Run `npm run build` (ensure no errors)
- [ ] Review security warnings in logs
- [ ] Check environment variables are properly set
- [ ] Verify database migrations applied
- [ ] Test rate limiting
- [ ] Test authentication flow
- [ ] Verify tenant isolation
- [ ] Test file upload validation

### Post-Deployment

- [ ] Monitor Sentry for errors
- [ ] Check API response times
- [ ] Verify database connection pool
- [ ] Test WebSocket connections
- [ ] Check rate limiting effectiveness
- [ ] Review authentication logs
- [ ] Monitor for suspicious activity

---

## 🚨 Incident Response

### Security Event Categories

1. **Critical** (Immediate Response Required)
   - Confirmed data breach
   - Active exploitation
   - RCE vulnerability detected
   - Data leak exposure

2. **High** (Response Within 1 Hour)
   - Suspicious activity patterns
   - Multiple failed authentication attempts
   - Unusual API usage patterns
   - Rate limiting triggers

3. **Medium** (Response Within 4 Hours)
   - Single failed authentication
   - Minor configuration issue
   - Dependency vulnerability detected

### Escalation Matrix

| Severity | Response Time | Notification |
|----------|---------------|--------------|
| Critical | Immediate | Page on-call, email all |
| High | 1 hour | Email security team, Slack |
| Medium | 4 hours | Email security team |
| Low | 24 hours | Create ticket |

---

## 📚 Security Resources

### Internal Documentation

- [Multi-Tenant Architecture](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

### External Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Snyk Learn](https://learn.snyk.io/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### Reporting Vulnerabilities

If you discover a security vulnerability, please:

1. **DO NOT** create a public issue
2. Email security@galeria.app
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

We will respond within 48 hours and provide regular updates on our progress.

---

## 🔑 Secrets Management

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Sentry
SENTRY_DSN=https://xxxxx@o1234.ingest.sentry.io/12345

# Snyk
SNYK_TOKEN=your-snyk-token-here

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Storage (R2 or S3)
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=galeria-dev
```

### Secrets Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** for dev/staging/production
3. **Rotate secrets regularly** (every 90 days)
4. **Use strong random values** (min 32 chars for JWT secrets)
5. **Limit secret access** (least privilege principle)
6. **Monitor for secret leaks** (use Gitleaks in pre-commit)

---

## 📈 Security Metrics

### Key Performance Indicators

| Metric | Target | Current |
|--------|--------|---------|
| Dependency Vulnerabilities | 0 critical | ✅ 0 |
| Code Security Issues | 0 high | ✅ Monitored |
| Mean Time to Patch (MTTP) | < 7 days | N/A |
| Failed Authentication Rate | < 5% | N/A |
| API Error Rate | < 1% | N/A |

---

## 🔄 Review Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Dependency updates | Daily (Dependabot) | Auto |
| Security scans | Every commit | CI/CD |
| Code review | Every PR | Team |
| Security audit | Quarterly | External |
| Penetration test | Annually | External |
| Policy review | Bi-annually | Security team |

---

**Last Updated**: January 9, 2026
**Security Team**: security@galeria.app
