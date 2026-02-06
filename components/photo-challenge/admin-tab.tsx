// ============================================
// Photo Challenge Admin Tab Component
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { Target, Gift, Users, Check, X, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PhotoChallengeSettingsForm } from '@/components/photo-challenge/settings-form';
import type { IPhotoChallenge, IGuestPhotoProgress } from '@/lib/types';

interface PhotoChallengeAdminTabProps {
  eventId: string;
}

export function PhotoChallengeAdminTab({ eventId }: PhotoChallengeAdminTabProps) {
  const [challenge, setChallenge] = useState<IPhotoChallenge | null>(null);
  const [progress, setProgress] = useState<IGuestPhotoProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [configRes, progressRes] = await Promise.all([
          fetch(`/api/events/${eventId}/photo-challenge`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}/photo-challenge/progress/all`, { credentials: 'include' }),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setChallenge(configData.data);
        }

        if (progressRes.ok) {
          const progressData = await progressRes.json();
          setProgress(progressData.data || []);
        }
      } catch (err) {
        console.error('[PHOTO_CHALLENGE_ADMIN] Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const handleDelete = async () => {
    if (!challenge) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/photo-challenge`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete challenge');
      }

      toast.success('Challenge deleted successfully');
      setChallenge(null);
      setProgress([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete challenge');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="mx-auto max-w-2xl">
        <PhotoChallengeSettingsForm
          eventId={eventId}
          existingChallenge={challenge}
          onSave={(saved) => {
            setChallenge(saved);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  // No challenge configured
  if (!challenge) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
          <Target className="h-10 w-10 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          No Photo Challenge Yet
        </h3>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Create a photo challenge to motivate guests to upload more photos
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-6 py-3 font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create Challenge
        </button>
      </div>
    );
  }

  // Challenge exists - show details
  const completedCount = progress.filter(p => p.goal_reached).length;
  const claimedCount = progress.filter(p => p.prize_claimed_at && !p.prize_revoked).length;

  return (
    <div className="space-y-6">
      {/* Challenge Header */}
      <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50 p-6 dark:border-gray-700 dark:from-violet-950/20 dark:to-purple-950/20">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {challenge.goal_photos} Photo Goal
              </h3>
              {challenge.enabled ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Check className="mr-1 h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  <X className="mr-1 h-3 w-3" />
                  Disabled
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Prize: <span className="font-medium text-gray-900 dark:text-gray-100">{challenge.prize_title}</span>
            </p>
            {challenge.prize_description && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                {challenge.prize_description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
              <span>Auto-grant: {challenge.auto_grant ? 'Yes' : 'No'}</span>
              {challenge.prize_tier && <span>Tier: {challenge.prize_tier}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
              <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{progress.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Participants</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Goal Reached</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{claimedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prizes Claimed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress List */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Guest Progress
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track how close each guest is to reaching the goal
          </p>
        </div>

        {progress.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">
              No participants yet. Guests will appear here as they upload photos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {progress.map((p) => {
              const percent = Math.min(100, Math.round((p.photos_approved / challenge.goal_photos) * 100));
              return (
                <div key={p.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-pink-100 text-sm font-semibold text-violet-700 dark:from-violet-900/30 dark:to-pink-900/30 dark:text-violet-300">
                        {p.user_fingerprint.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Guest {p.user_fingerprint.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {p.photos_approved} / {challenge.goal_photos} photos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      {p.goal_reached && !p.prize_revoked && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {p.prize_claimed_at ? 'Claimed' : 'Ready!'}
                        </span>
                      )}
                      {p.prize_revoked && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Revoked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
