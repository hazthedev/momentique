// ============================================
// Galeria - Sentry Configuration
// ============================================
// Error tracking, performance monitoring, and security monitoring

import * as Sentry from "@sentry/nextjs";

// Initialize Sentry
Sentry.init({
  // ============================================
  // DSN (Data Source Name)
  // ============================================
  dsn: process.env.SENTRY_DSN || "",

  // ============================================
  // ENVIRONMENT
  // ============================================
  environment: process.env.NODE_ENV || "development",

  // ============================================
  // RELEASE
  // ============================================
  // Automatically set release from git SHA or package.json
  release: process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    undefined,

  // ============================================
  // SAMPLE RATE
  // ============================================
  // Percentage of transactions to send to Sentry
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // ============================================
  // PROFILES SAMPLE RATE
  // ============================================
  // Percentage of profiler sessions to sample
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // ============================================
  // INTEGRATIONS
  // ============================================

  // ============================================
  // BEFORE SEND TRANSACTION
  // ============================================
  // Filter and modify events before sending to Sentry
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Sentry] Event captured in development:", event, hint);
      return null;
    }

    // Filter out specific error types
    if (event.exception) {
      const error = hint?.originalException;

      // Don't send known safe errors
      if (error instanceof Error) {
        // Network errors (user offline, etc.)
        if (error.message.includes("NetworkError")) {
          return null;
        }

        // Aborted requests (user navigated away)
        if (error.message.includes("AbortError")) {
          return null;
        }
      }
    }

    // Add custom context
    event.contexts = {
      ...event.contexts,
      app: {
        name: "Galeria",
        type: "multi-tenant-saas",
      },
    };

    // Add tenant context if available
    if (event.request?.headers) {
      const tenantId = event.request.headers["x-tenant-id"];
      if (tenantId) {
        event.tags = {
          ...event.tags,
          tenant_id: tenantId,
        };
      }
    }

    return event;
  },

  // ============================================
  // BEFORE SEND TRANSACTION (PERFORMANCE)
  // ============================================
  // Filter and modify performance transactions
  beforeSendTransaction(event) {
    // Don't send transactions in development
    if (process.env.NODE_ENV === "development") {
      return null;
    }

    // Filter out health check transactions
    const txnName = event.transaction;
    if (txnName?.includes("/health") ||
      txnName?.includes("/api/health")) {
      return null;
    }

    return event;
  },

  // ============================================
  // USER CONTEXT
  // ============================================
  // Capture user information for debugging
  initialScope: {
    tags: {
      framework: "nextjs",
      runtime: "node",
    },
  },

  // ============================================
  // DEBUG MODE
  // ============================================
  // Enable debug in development
  debug: process.env.NODE_ENV === "development",

  // ============================================
  // ATTACH STACKTRACE
  // ============================================
  attachStacktrace: true,

  // ============================================
  // MAX BREMAS (MESSAGE LENGTH LIMIT)
  // ============================================
  maxValueLength: 1000,

  // ============================================
  // NORMALIZE DEPTH
  // ============================================
  // How deep to normalize nested objects
  normalizeDepth: 10,

  // ============================================
  // IGNORE ERRORS
  // ============================================
  // Ignore specific error messages
  ignoreErrors: [
    // Network errors (common in mobile browsers)
    "Non-Error promise rejection captured",

    // Third-party script errors (not our responsibility)
    "Script error",

    // Browser extensions
    "chrome-extension://",

    // Ad blockers
    "adblock",

    // Known safe errors
    "ResizeObserver loop limit exceeded",
  ],

  // ============================================
  // DENY LIST URLS
  // ============================================
  // Don't send errors from specific URLs
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,

    // Third-party analytics
    /googletagmanager\.com/i,
    /google-analytics\.com/i,

    // Ad networks
    /doubleclick\.net/i,
    /facebook\.com.*trampoline/i,

    // Known bot traffic
    /bot/i,
    /spider/i,
    /crawl/i,
  ],

  // ============================================
  // ALLOW LIST URLS
  // ============================================
  // Only send errors from specific domains (optional)
  // allowUrls: [
  //   /galeria\.app/i,
  //   /localhost/i,
  // ],
});

// ============================================
// SECURITY MONITORING
// ============================================

// Track security events
export function captureSecurityEvent(
  event: {
    type: "sql_injection" | "xss" | "auth_failure" | "rate_limit_exceeded" | "suspicious_activity";
    severity: "low" | "medium" | "high" | "critical";
    details?: Record<string, unknown>;
    userId?: string;
    tenantId?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setTag("security_event", event.type);
    scope.setTag("severity", event.severity);
    scope.setLevel(event.severity === "critical" ? "error" : "warning");

    // Add user context
    if (event.userId) {
      scope.setUser({ id: event.userId });
    }

    // Add tenant context
    if (event.tenantId) {
      scope.setTag("tenant_id", event.tenantId);
    }

    // Add details
    scope.setContext("security_details", event.details || {});

    // Send event
    Sentry.captureMessage(`Security Event: ${event.type}`, {
      level: event.severity === "critical" ? "error" : "warning",
    });
  });
}

// ============================================
// PERFORMANCE MONITORING
// ============================================

// Track API performance
export function captureApiPerformance(
  route: string,
  duration: number,
  statusCode: number,
  metadata?: Record<string, unknown>
) {
  Sentry.withScope((scope) => {
    scope.setTag("api_route", route);
    scope.setTag("status_code", statusCode);
    scope.setContext("api_metadata", metadata || {});

    // Log slow requests
    if (duration > 1000) {
      Sentry.captureMessage(`Slow API: ${route}`, {
        level: "warning",
        extra: {
          duration: `${duration}ms`,
          statusCode,
          metadata,
        },
      });
    }
  });
}

// ============================================
// ERROR HANDLING HELPERS
// ============================================

// Wrap async functions with error tracking
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: {
    name?: string;
    metadata?: Record<string, unknown>;
  }
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setContext("function_context", {
          name: context?.name || fn.name,
          metadata: context?.metadata || {},
        });

        Sentry.captureException(error);
      });

      throw error;
    }
  }) as T;
}

// ============================================
// EXPORT SENTRY
// ============================================

export { Sentry };

// Export utilities
export { captureException } from "@sentry/nextjs";
export { captureMessage } from "@sentry/nextjs";
export { withSentryRouting } from "@sentry/nextjs";
