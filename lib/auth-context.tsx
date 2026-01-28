// ============================================
// MOMENTIQUE - Authentication Context
// ============================================
// Client-side authentication state management

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { IUser, ISessionData } from './types';

// ============================================
// TYPES
// ============================================

interface AuthContextValue {
  user: IUser | null;
  session: ISessionData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface MeResponse {
  user: IUser | null;
  tenant?: unknown;
  message?: string;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<IUser | null>(null);
  const [session, setSession] = useState<ISessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current user value to avoid stale closures
  const userRef = useRef<IUser | null>(null);

  // Update ref whenever user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch current user data
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data: MeResponse = await response.json();
        if (data.user) {
          setUser(data.user);
          // Create minimal session object from user data
          setSession({
            userId: data.user.id,
            tenantId: data.user.tenant_id,
            role: data.user.role,
            email: data.user.email,
            name: data.user.name,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + 604800000, // 7 days
            rememberMe: false,
          });
        } else {
          setUser(null);
          setSession(null);
        }
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      console.error('[AUTH_CONTEXT] Error fetching user:', err);
      setError('Failed to fetch user data');
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('[AUTH_CONTEXT] Logout error:', err);
    } finally {
      setUser(null);
      setSession(null);
      router.push('/auth/login');
    }
  }, [router]);

  // Fetch user on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // NOTE: Removed auto-refresh on route change to improve performance.
  // The session is validated on mount and on protected API calls.
  // If you need to re-validate after inactivity, consider using a visibility change listener instead.

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    error,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// HOOK
// ============================================

/**
 * Use authentication context
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// ============================================
// HOC (Higher-Order Component)
// ============================================

/**
 * HOC to require authentication for a component
 * Redirects to login page if not authenticated
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  redirectTo: string = '/auth/login'
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push(redirectTo);
      }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600 dark:border-violet-800 dark:border-t-violet-400" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
