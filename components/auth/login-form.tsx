// ============================================
// Galeria - Login Form Component
// ============================================
// Login form with email and password validation

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';

// ============================================
// TYPES
// ============================================

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  sessionId?: string;
  message?: string;
  error?: string;
}

interface ApiError {
  error: string;
  message: string;
  code?: string;
}

// ============================================
// COMPONENT
// ============================================

export function LoginForm({ onSuccess, redirectTo = '/organizer', className }: LoginFormProps) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LoginFormData, string>> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Clear previous errors
    setApiError(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          rememberMe: formData.rememberMe,
        }),
        credentials: 'include', // Important for cookies
      });

      const data: LoginResponse | ApiError = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        const msg = errorData.message || 'Login failed. Please try again.';
        setApiError(msg);
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      const successData = data as LoginResponse;

      if (successData.success) {
        // Refresh auth context to ensure global state is updated BEFORE navigation
        await refresh();

        // Call onSuccess callback if provided
        onSuccess?.();

        toast.success('Welcome back!');

        // Redirect based on user role - use window.location for full page load
        // This ensures cookies are properly read and auth state is fresh
        let destination = redirectTo;
        if (successData.user?.role === 'super_admin') {
          destination = '/admin';
        } else if (redirectTo === '/organizer' || !redirectTo) {
          destination = '/organizer';
        }

        window.location.href = destination;
      } else {
        const msg = successData.error || 'Login failed. Please try again.';
        setApiError(msg);
        toast.error(msg);
      }
    } catch (error) {
      console.error('[LOGIN] Error:', error);
      const msg = 'An unexpected error occurred. Please try again.';
      setApiError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={clsx('space-y-5', className)}>
      {/* API Error */}
      {apiError && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          {apiError}
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={e => handleInputChange('email', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.email,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.email,
            }
          )}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'email-error' : undefined}
          placeholder="you@example.com"
          disabled={isLoading}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-red-600 dark:text-red-400">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={formData.password}
          onChange={e => handleInputChange('password', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.password,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.password,
            }
          )}
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'password-error' : undefined}
          placeholder="••••••••"
          disabled={isLoading}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-red-600 dark:text-red-400">
            {errors.password}
          </p>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center">
        <input
          id="remember-me"
          type="checkbox"
          checked={formData.rememberMe}
          onChange={e => handleInputChange('rememberMe', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800"
          disabled={isLoading}
        />
        <label
          htmlFor="remember-me"
          className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
        >
          Remember me for 30 days
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className={clsx(
          'flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          {
            'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500 dark:bg-violet-500 dark:hover:bg-violet-600':
              !isLoading,
            'bg-violet-400': isLoading,
          }
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}
