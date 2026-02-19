// ============================================
// Galeria - reCAPTCHA v3 Component
// ============================================
// Client-side reCAPTCHA v3 component with fallback challenge

'use client';

import { useState, useEffect, useRef, useId } from 'react';

// ============================================
// TYPES
// ============================================

interface RecaptchaProps {
  onError?: (error: string) => void;
  onVerified?: (token: string) => void;
  onExpired?: () => void;
  className?: string;
  tenantId?: string;
  showFallback?: boolean;
}

interface RecaptchaState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  useFallback: boolean;
  fallbackQuestion: string;
  fallbackSessionId: string;
  userAnswer: string;
  verifying: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function Recaptcha({
  onError,
  onVerified,
  onExpired,
  className = '',
  tenantId,
  showFallback = false,
}: RecaptchaProps) {
  const [state, setState] = useState<RecaptchaState>({
    loaded: false,
    loading: false,
    error: null,
    useFallback: showFallback,
    fallbackQuestion: '',
    fallbackSessionId: '',
    userAnswer: '',
    verifying: false,
  });

  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaId = useId();

  // Load reCAPTCHA site key
  const [siteKey, setSiteKey] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(false);

  // Generate fallback math challenge
  const generateFallbackChallenge = async () => {
    try {
      const response = await fetch('/api/auth/recaptcha/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate fallback challenge');
      }

      setState((prev) => ({
        ...prev,
        fallbackQuestion: data.question || '',
        fallbackSessionId: data.sessionId || '',
        userAnswer: '',
      }));
    } catch (err) {
      console.error('[RECAPTCHA] Failed to generate challenge:', err);
      setState((prev) => ({
        ...prev,
        error: 'Failed to generate fallback challenge',
      }));
    }
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleRecaptchaVerified = (token: string) => {
    setState((prev) => ({ ...prev, error: null, verifying: false }));
    onVerified?.(token);
  };

  const handleRecaptchaExpired = () => {
    setState((prev) => ({ ...prev, error: 'CAPTCHA expired, please try again' }));
    onExpired?.();
  };

  const handleRecaptchaError = () => {
    setState((prev) => ({
      ...prev,
      error: 'CAPTCHA error occurred, please try again or use fallback',
      useFallback: true,
    }));
    generateFallbackChallenge();
  };

  const handleFallbackSubmit = async () => {
    const userAns = parseInt(state.userAnswer, 10);
    if (isNaN(userAns)) {
      setState((prev) => ({ ...prev, error: 'Please enter a valid number' }));
      return;
    }

    setState((prev) => ({ ...prev, verifying: true, error: null }));

    try {
      const response = await fetch('/api/auth/recaptcha/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.fallbackSessionId,
          answer: userAns,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setState((prev) => ({ ...prev, verifying: false, userAnswer: '' }));
        onVerified?.(data.token || 'fallback_passed');
      } else {
        setState((prev) => ({
          ...prev,
          verifying: false,
          error: 'Incorrect answer, please try again',
        }));
        // Generate new challenge
        await generateFallbackChallenge();
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        verifying: false,
        error: 'Verification failed, please try again',
      }));
    }
  };

  useEffect(() => {
    // Fetch site key from API
    fetch('/api/auth/recaptcha/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.enabled && data.siteKey) {
          setSiteKey(data.siteKey);
          setEnabled(true);
        } else {
          // If reCAPTCHA not configured, show fallback immediately
          setState((prev) => ({ ...prev, useFallback: true }));
          void generateFallbackChallenge();
        }
      })
      .catch((err) => {
        console.error('[RECAPTCHA] Failed to load config:', err);
        // On error, use fallback
        setState((prev) => ({ ...prev, useFallback: true, error: 'Failed to load CAPTCHA' }));
        void generateFallbackChallenge();
      });
  }, []);

  // Execute reCAPTCHA when component renders
  useEffect(() => {
    if (!enabled || !siteKey || state.useFallback) return;

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.grecaptcha) {
        setState((prev) => ({ ...prev, loaded: true }));

        // Render the reCAPTCHA widget
        window.grecaptcha.render(recaptchaId, {
          sitekey: siteKey,
          callback: handleRecaptchaVerified,
          'expired-callback': handleRecaptchaExpired,
          'error-callback': handleRecaptchaError,
        });
      }
    };

    script.onerror = () => {
      console.error('[RECAPTCHA] Failed to load script');
      setState((prev) => ({
        ...prev,
        useFallback: true,
        error: 'Failed to load CAPTCHA, using fallback',
      }));
      void generateFallbackChallenge();
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [enabled, siteKey, state.useFallback]);

  // ============================================
  // RENDER
  // ============================================

  if (state.loading) {
    return (
      <div className={`recaptcha-loading ${className}`}>
        <div className="animate-pulse bg-gray-200 h-12 w-48 rounded"></div>
      </div>
    );
  }

  if (state.useFallback) {
    return (
      <div className={`recaptcha-fallback ${className}`}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-gray-900 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
          <p className="text-sm text-yellow-800 mb-3">
            {state.error || 'Please complete this security check:'}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-900 dark:text-yellow-100">
              {state.fallbackQuestion}
            </span>
            <input
              type="number"
              value={state.userAnswer}
              onChange={(e) => setState((prev) => ({ ...prev, userAnswer: e.target.value }))}
              className="w-24 px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:border-yellow-700 dark:bg-yellow-50 dark:text-gray-900"
              disabled={state.verifying}
              placeholder="?"
            />
            <button
              onClick={handleFallbackSubmit}
              disabled={state.verifying || !state.userAnswer}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {state.verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
          {state.error && (
            <p className="text-red-700 dark:text-red-300 text-sm mt-2">{state.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`recaptcha-container ${className}`}>
      <div
        ref={recaptchaRef}
        id={recaptchaId}
        className="g-recaptcha"
        data-sitekey={siteKey}
      />
      {state.error && !state.useFallback && (
        <p className="text-red-600 text-sm mt-2">{state.error}</p>
      )}
    </div>
  );
}

// ============================================
// HOOK FOR PROGRAMMATIC USE
// ============================================

/**
 * Hook to trigger reCAPTCHA verification programmatically
 */
export function useRecaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeRecaptcha = async () => {
    setLoading(true);
    setError(null);

    try {
      if (window.grecaptcha) {
        const responseToken = await window.grecaptcha.execute('upload', {
          action: 'upload',
        });
        setToken(responseToken);
        return responseToken;
      } else {
        throw new Error('reCAPTCHA not loaded');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'CAPTCHA execution failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setToken(null);
    setError(null);
  };

  return {
    token,
    loading,
    error,
    executeRecaptcha,
    reset,
  };
}

// ============================================
// STYLES (can be moved to CSS module)
// ============================================

export const recaptchaStyles = `
  .recaptcha-container {
    display: inline-block;
  }
  .recaptcha-loading {
    display: inline-block;
  }
  .recaptcha-fallback {
    display: block;
  }
`;
