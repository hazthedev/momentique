// ============================================
// Galeria - Organizer Billing & Plan Page
// ============================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Crown, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { TIER_CONFIGS } from '@/lib/tier-config';
import type { SubscriptionTier } from '@/lib/types';

const ORDERED_TIERS: SubscriptionTier[] = ['free', 'pro', 'premium', 'enterprise', 'tester'];

const formatLimit = (value: number | string[]) => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
};

export default function OrganizerBillingPage() {
  const { user, isLoading } = useAuth();
  const [usageTier, setUsageTier] = useState<SubscriptionTier | null>(null);
  const currentTier = (usageTier || user?.subscription_tier || 'free') as SubscriptionTier;
  const [usage, setUsage] = useState<{
    eventsThisMonth: number;
    totalEvents: number;
    totalPhotos: number;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const visibleTiers = useMemo(() => {
    return ORDERED_TIERS.filter((tier) => tier !== 'tester' || currentTier === 'tester');
  }, [currentTier]);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setUsageLoading(true);
        const response = await fetch('/api/organizer/usage', { credentials: 'include' });
        const data = await response.json();
        if (response.ok) {
          setUsageTier((data.data?.tier || null) as SubscriptionTier | null);
          setUsage(data.data?.usage || null);
        } else {
          setUsageTier(null);
          setUsage(null);
        }
      } catch {
        setUsageTier(null);
        setUsage(null);
      } finally {
        setUsageLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Plan</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your organizer plan, limits, and upgrade options.
          </p>
        </div>
        <div className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
          Current plan: <span className="capitalize">{currentTier}</span>
        </div>
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Events this month</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {usageLoading ? '...' : usage?.eventsThisMonth ?? 0}
            <span className="text-sm font-medium text-gray-500">
              {' '}
              / {formatLimit(TIER_CONFIGS[currentTier].limits.max_events_per_month)}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Total events: {usageLoading ? '...' : usage?.totalEvents ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Photos uploaded</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {usageLoading ? '...' : usage?.totalPhotos ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Limit per event: {formatLimit(TIER_CONFIGS[currentTier].limits.max_photos_per_event)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Draw entries per event</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {formatLimit(TIER_CONFIGS[currentTier].limits.max_draw_entries_per_event)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {TIER_CONFIGS[currentTier].features.lucky_draw ? 'Lucky draw enabled' : 'Lucky draw disabled'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {visibleTiers.map((tier) => {
          const config = TIER_CONFIGS[tier];
          const isCurrent = tier === currentTier;
          const isTop = tier === 'premium';
          const isEnterprise = tier === 'enterprise';
          const isTester = tier === 'tester';

          return (
            <div
              key={tier}
              className={clsx(
                'rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900',
                isCurrent && 'border-violet-400 ring-2 ring-violet-200 dark:ring-violet-900/50'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {config.displayName}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{config.description}</p>
                </div>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <CheckCircle className="h-4 w-4" /> Current
                  </span>
                )}
              </div>

              <div className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                {config.priceMonthly === -1 ? 'Custom' : config.priceMonthly === 0 ? 'Free' : `$${(config.priceMonthly / 100).toFixed(0)}`}
                {config.priceMonthly > 0 && <span className="text-sm font-medium text-gray-500">/month</span>}
              </div>

              <div className="mt-5 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {formatLimit(config.limits.max_events_per_month)} events / month
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {formatLimit(config.limits.max_photos_per_event)} photos / event
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {formatLimit(config.limits.max_draw_entries_per_event)} draw entries / event
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {config.features.lucky_draw ? 'Lucky draw enabled' : 'Lucky draw disabled'}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {config.features.white_label ? 'White label branding' : 'Powered by Galeria branding'}
                </div>
              </div>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 dark:border-gray-700"
                    disabled
                  >
                    Your current plan
                  </button>
                ) : isTester ? (
                  <button
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 dark:border-gray-700"
                    disabled
                  >
                    Internal only
                  </button>
                ) : isEnterprise ? (
                  <a
                    href="mailto:support@galeria.com?subject=Enterprise%20Plan%20Inquiry"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Contact sales
                  </a>
                ) : (
                  <a
                    href={`mailto:support@galeria.com?subject=Upgrade%20to%20${encodeURIComponent(config.displayName)}`}
                    className={clsx(
                      'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white',
                      isTop ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:opacity-90' : 'bg-violet-600 hover:bg-violet-700'
                    )}
                  >
                    <Crown className="h-4 w-4" />
                    Request upgrade
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Need help choosing?</h3>
        <p className="mt-2">
          Talk to us about usage patterns, team size, and event volume. We can recommend the best plan for your workflow.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="mailto:support@galeria.com?subject=Plan%20Recommendation"
            className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
          >
            Contact support
          </a>
          <Link
            href="/organizer"
            className="rounded-lg border border-gray-200 px-4 py-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
