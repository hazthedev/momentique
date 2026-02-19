// ============================================
// Galeria - Password Input Component
// ============================================
// Password input with visibility toggle and strength indicator

'use client';

import { useState, forwardRef, useId } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

// ============================================
// TYPES
// ============================================

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  showStrength?: boolean;
  strength?: 'weak' | 'moderate' | 'strong' | 'very-strong' | null;
  helperText?: string;
}

// ============================================
// STRENGTH COLORS
// ============================================

const STRENGTH_COLORS = {
  weak: 'bg-red-500',
  moderate: 'bg-amber-500',
  strong: 'bg-green-500',
  'very-strong': 'bg-green-600',
};

const STRENGTH_LABELS = {
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
  'very-strong': 'Very Strong',
};

// ============================================
// COMPONENT
// ============================================

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      error,
      showStrength = false,
      strength,
      helperText,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const generatedId = useId();
    const inputId = id || `password-${generatedId}`;

    const togglePassword = () => {
      setShowPassword(prev => !prev);
    };

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            className={clsx(
              'block w-full rounded-lg border px-4 py-2.5 pr-12 text-sm',
              'transition-colors duration-200',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              {
                'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                  !error,
                'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                  error,
              },
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {/* Visibility Toggle Button */}
          <button
            type="button"
            onClick={togglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Password Strength Indicator */}
        {showStrength && strength && (
          <div className="space-y-1">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={clsx(
                  'h-full transition-all duration-300 ease-out',
                  STRENGTH_COLORS[strength]
                )}
                style={{
                  width:
                    strength === 'weak'
                      ? '25%'
                      : strength === 'moderate'
                      ? '50%'
                      : strength === 'strong'
                      ? '75%'
                      : '100%',
                }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Password strength: <span className="font-medium">{STRENGTH_LABELS[strength]}</span>
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span id={`${inputId}-error`}>{error}</span>
          </div>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
