// ============================================
// Photo Challenge Settings Form Component
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, Target, Gift, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { IPhotoChallenge } from '@/lib/types';

interface PhotoChallengeSettingsFormProps {
  eventId: string;
  existingChallenge: IPhotoChallenge | null;
  onSave: (challenge: IPhotoChallenge) => void;
  onCancel: () => void;
}

export function PhotoChallengeSettingsForm({
  eventId,
  existingChallenge,
  onSave,
  onCancel,
}: PhotoChallengeSettingsFormProps) {
  const [goalPhotos, setGoalPhotos] = useState(existingChallenge?.goal_photos || 5);
  const [prizeTitle, setPrizeTitle] = useState(existingChallenge?.prize_title || '');
  const [prizeDescription, setPrizeDescription] = useState(existingChallenge?.prize_description || '');
  const [prizeTier, setPrizeTier] = useState(existingChallenge?.prize_tier || '');
  const [enabled, setEnabled] = useState(existingChallenge?.enabled ?? true);
  const [autoGrant, setAutoGrant] = useState(existingChallenge?.auto_grant ?? true);
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!existingChallenge;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (goalPhotos < 1) {
      toast.error('Goal must be at least 1 photo');
      return;
    }
    if (goalPhotos > 100) {
      toast.error('Goal cannot exceed 100 photos');
      return;
    }
    if (!prizeTitle.trim()) {
      toast.error('Please enter a prize title');
      return;
    }

    setIsLoading(true);

    try {
      const url = `/api/events/${eventId}/photo-challenge`;
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          goal_photos: goalPhotos,
          prize_title: prizeTitle.trim(),
          prize_description: prizeDescription.trim() || undefined,
          prize_tier: prizeTier.trim() || undefined,
          enabled,
          auto_grant: autoGrant,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save challenge');
      }

      toast.success(isEditing ? 'Challenge updated!' : 'Challenge created!');
      onSave(data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save challenge');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Challenge' : 'Create Photo Challenge'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Motivate guests with upload goals and prizes
          </p>
        </div>
      </div>

      {/* Goal Settings */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
          Photo Goal
        </label>
        <input
          type="number"
          min="1"
          max="100"
          value={goalPhotos}
          onChange={(e) => setGoalPhotos(parseInt(e.target.value) || 1)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="e.g., 5"
        />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Number of photos guests need to upload to unlock the prize
        </p>
      </div>

      {/* Prize Settings */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Prize Details
          </h4>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Prize Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={prizeTitle}
            onChange={(e) => setPrizeTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="e.g., Free Drink Ticket"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Prize Description
          </label>
          <textarea
            value={prizeDescription}
            onChange={(e) => setPrizeDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Optional details about the prize..."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Prize Tier
          </label>
          <input
            type="text"
            value={prizeTier}
            onChange={(e) => setPrizeTier(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="e.g., Gold, Silver, Bronze"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Optional tier level for the prize
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Enabled
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Challenge is active for guests
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
        </label>

        <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
          <div className="flex items-center gap-3">
            <Gift className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Auto-grant Prize
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically award prize when goal is reached
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoGrant}
            onChange={(e) => setAutoGrant(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isEditing ? 'Update' : 'Create'} Challenge
            </>
          )}
        </button>
      </div>
    </form>
  );
}
