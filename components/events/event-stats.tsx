// ============================================
// Galeria - Event Stats Component
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Users, Heart, AlertCircle, TrendingUp, Loader2, Sparkles, Trophy } from 'lucide-react';
import clsx from 'clsx';

interface EventStatsData {
  totalPhotos: number;
  totalParticipants: number;
  photosToday: number;
  avgPhotosPerUser: number;
  topContributors: { name: string; count: number }[];
  uploadTimeline: { date: string; count: number }[];
  totalReactions: number;
  pendingModeration: number;
  luckyDrawStatus: 'active' | 'not_set';
  luckyDrawEntryCount: number;
  tierMaxPhotosPerEvent: number;
  tierDisplayName: string;
  topLikedPhotos: {
    id: string;
    imageUrl: string;
    heartCount: number;
    contributorName: string;
    isAnonymous: boolean;
  }[];
}

interface EventStatsProps {
  eventId: string;
  refreshInterval?: number;
  className?: string;
}

const statCards = [
  {
    key: 'totalPhotos',
    label: 'Total Photos',
    icon: ImageIcon,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    textColor: 'text-violet-700 dark:text-violet-400',
  },
  {
    key: 'totalParticipants',
    label: 'Participants',
    icon: Users,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  {
    key: 'totalReactions',
    label: 'Total Reactions',
    icon: Heart,
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    textColor: 'text-pink-700 dark:text-pink-400',
  },
  {
    key: 'pendingModeration',
    label: 'Pending Review',
    icon: AlertCircle,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    textColor: 'text-orange-700 dark:text-orange-400',
  },
];

export function EventStats({ eventId, refreshInterval = 30000, className }: EventStatsProps) {
  const [stats, setStats] = useState<EventStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/stats`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        const message = data.error || data.message || 'Failed to fetch stats';
        setError(message);
        setStats(null);
        setWarnings([]);
        return;
      }

      setStats(data.data);
      setError(null);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      setWarnings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [eventId, refreshInterval]);

  if (isLoading) {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx('rounded-lg bg-red-50 p-6 text-center', className)}>
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate max for timeline chart scaling
  const maxTimelineCount = Math.max(...stats.uploadTimeline.map(d => d.count), 1);
  const tierLimitLabel =
    stats.tierMaxPhotosPerEvent < 0
      ? 'Unlimited'
      : stats.tierMaxPhotosPerEvent.toLocaleString();

  return (
    <div className={clsx('space-y-6', className)}>
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
          {warnings[0]}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(card => {
          const Icon = card.icon;
          const value = stats[card.key as keyof EventStatsData] as number;
          const subValue = card.key === 'totalPhotos' ? stats.photosToday : undefined;

          return (
            <div
              key={card.key}
              className={clsx(
                'rounded-xl border p-4',
                'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              )}
            >
              <div className={clsx('flex items-center gap-3')}>
                <div className={clsx('rounded-lg p-2', card.bgColor)}>
                  <Icon className={clsx('h-5 w-5', card.textColor)} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {value.toLocaleString()}
                  </p>
                  {subValue !== undefined && subValue > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      +{subValue} today
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Avg Photos Per User */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-violet-600" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Photos Per User</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.avgPhotosPerUser.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Photo Limit ({stats.tierDisplayName})
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {tierLimitLabel}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lucky Draw Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tier Status</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.tierDisplayName}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Lucky Draw Status</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.luckyDrawStatus === 'active' ? 'Configured' : 'Not set'}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Lucky Draw Entries</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.luckyDrawEntryCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Contributors */}
      {stats.topContributors.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Contributors
          </h3>
          <div className="space-y-3">
            {stats.topContributors.map((contributor, index) => (
              <div
                key={contributor.name}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      index === 0
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : index === 1
                          ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                          : index === 2
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {contributor.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {contributor.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Liked Photos */}
      {stats.topLikedPhotos.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Liked Photos
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.topLikedPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <div className="relative aspect-square w-full bg-gray-100 dark:bg-gray-700">
                  {photo.imageUrl ? (
                    <img
                      src={photo.imageUrl}
                      alt={`Top liked ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                    #{index + 1}
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="truncate text-xs text-gray-600 dark:text-gray-400">
                    {photo.contributorName}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-pink-600 dark:text-pink-400">
                    <Heart className="h-4 w-4 fill-pink-600 text-pink-600 dark:fill-pink-400 dark:text-pink-400" />
                    {photo.heartCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EventStats;
