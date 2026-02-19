// ============================================
// Galeria - Register Form Component
// ============================================
// Registration form with email, password, and name validation

'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

// ============================================
// TYPES
// ============================================

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
}

interface RegisterResponse {
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

interface PasswordValidationResult {
  valid: boolean;
  strength: 'weak' | 'moderate' | 'strong' | 'very-strong';
  errors: string[];
  warnings: string[];
  score: number;
}

// ============================================
// COMPONENT
// ============================================

export function RegisterForm({ onSuccess, redirectTo = '/events', className }: RegisterFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordValidationResult | null>(null);

  // Validate password strength on change
  useEffect(() => {
    if (formData.password) {
      validatePasswordStrength(formData.password);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  const validatePasswordStrength = async (password: string) => {
    try {
      // Client-side validation (basic implementation)
      const result: PasswordValidationResult = {
        valid: password.length >= 8,
        strength: 'weak',
        errors: [],
        warnings: [],
        score: 0,
      };

      // Calculate basic strength
      let score = 0;
      if (password.length >= 8) score += 20;
      if (password.length >= 12) score += 20;
      if (/[a-z]/.test(password)) score += 15;
      if (/[A-Z]/.test(password)) score += 15;
      if (/[0-9]/.test(password)) score += 15;
      if (/[^a-zA-Z0-9]/.test(password)) score += 15;

      result.score = score;

      if (score < 30) result.strength = 'weak';
      else if (score < 50) result.strength = 'moderate';
      else if (score < 75) result.strength = 'strong';
      else result.strength = 'very-strong';

      // Check requirements
      if (password.length < 8) {
        result.errors.push('Password must be at least 8 characters');
      }
      if (!/[a-zA-Z]/.test(password)) {
        result.errors.push('Password must contain letters');
      }
      if (!/[0-9]/.test(password)) {
        result.errors.push('Password must contain numbers');
      }

      result.valid = result.errors.length === 0;

      setPasswordStrength(result);
    } catch (error) {
      console.error('[PASSWORD_VALIDATION] Error:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof RegisterFormData, string>> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordStrength && !passwordStrength.valid) {
      newErrors.password = passwordStrength.errors[0] || 'Password does not meet requirements';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name.trim(),
        }),
        credentials: 'include',
      });

      const data: RegisterResponse | ApiError = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        const msg = errorData.message || 'Registration failed. Please try again.';
        setApiError(msg);
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      const successData = data as RegisterResponse;

      if (successData.success) {
        // Call onSuccess callback if provided
        onSuccess?.();

        toast.success('Account created successfully!');
        // Redirect to specified page
        router.push(redirectTo);
        router.refresh();
      } else {
        const msg = successData.error || 'Registration failed. Please try again.';
        setApiError(msg);
        toast.error(msg);
      }
    } catch (error) {
      console.error('[REGISTER] Error:', error);
      const msg = 'An unexpected error occurred. Please try again.';
      setApiError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
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

  const getStrengthColor = () => {
    if (!passwordStrength) return 'bg-gray-200';
    switch (passwordStrength.strength) {
      case 'weak':
        return 'bg-red-500';
      case 'moderate':
        return 'bg-amber-500';
      case 'strong':
        return 'bg-green-500';
      case 'very-strong':
        return 'bg-green-600';
      default:
        return 'bg-gray-200';
    }
  };

  const getStrengthWidth = () => {
    if (!passwordStrength) return 0;
    switch (passwordStrength.strength) {
      case 'weak':
        return 25;
      case 'moderate':
        return 50;
      case 'strong':
        return 75;
      case 'very-strong':
        return 100;
      default:
        return 0;
    }
  };

  const getStrengthLabel = () => {
    if (!passwordStrength) return '';
    switch (passwordStrength.strength) {
      case 'weak':
        return 'Weak';
      case 'moderate':
        return 'Moderate';
      case 'strong':
        return 'Strong';
      case 'very-strong':
        return 'Very Strong';
      default:
        return '';
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

      {/* Name Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Full Name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={formData.name}
          onChange={e => handleInputChange('name', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.name,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.name,
            }
          )}
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-describedby={errors.name ? 'name-error' : undefined}
          placeholder="John Doe"
          disabled={isLoading}
        />
        {errors.name && (
          <p id="name-error" className="text-sm text-red-600 dark:text-red-400">
            {errors.name}
          </p>
        )}
      </div>

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
          autoComplete="new-password"
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
          aria-describedby={errors.password ? 'password-error' : 'password-strength'}
          placeholder="••••••••"
          disabled={isLoading}
        />

        {/* Password Strength Indicator */}
        {formData.password && (
          <div className="space-y-1">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={clsx('h-full transition-all duration-300 ease-out', getStrengthColor())}
                style={{ width: `${getStrengthWidth()}%` }}
              />
            </div>
            {passwordStrength && passwordStrength.valid && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>
                  Password strength: <span className="font-medium">{getStrengthLabel()}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {errors.password && (
          <p id="password-error" className="text-sm text-red-600 dark:text-red-400">
            {errors.password}
          </p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={e => handleInputChange('confirmPassword', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.confirmPassword,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.confirmPassword,
            }
          )}
          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
          aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
          placeholder="••••••••"
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" className="text-sm text-red-600 dark:text-red-400">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || (passwordStrength !== null && !passwordStrength.valid)}
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
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
