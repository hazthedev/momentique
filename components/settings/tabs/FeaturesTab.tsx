import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import clsx from 'clsx';
import { Check, Download, Eye, Hash, Loader2, Sparkles, Target, Users } from 'lucide-react';
import type { SettingsFeatureHighlight } from '@/components/settings/types';

interface FeaturesTabProps {
  guestDownloadEnabled: boolean;
  setGuestDownloadEnabled: Dispatch<SetStateAction<boolean>>;
  moderationRequired: boolean;
  setModerationRequired: Dispatch<SetStateAction<boolean>>;
  anonymousAllowed: boolean;
  setAnonymousAllowed: Dispatch<SetStateAction<boolean>>;
  luckyDrawEnabled: boolean;
  setLuckyDrawEnabled: Dispatch<SetStateAction<boolean>>;
  attendanceEnabled: boolean;
  setAttendanceEnabled: Dispatch<SetStateAction<boolean>>;
  photoChallengeEnabled: boolean;
  setPhotoChallengeEnabled: Dispatch<SetStateAction<boolean>>;
  isLoading: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onDirty: () => void;
  highlightFeature?: SettingsFeatureHighlight;
}

export function FeaturesTab({
  guestDownloadEnabled,
  setGuestDownloadEnabled,
  moderationRequired,
  setModerationRequired,
  anonymousAllowed,
  setAnonymousAllowed,
  luckyDrawEnabled,
  setLuckyDrawEnabled,
  attendanceEnabled,
  setAttendanceEnabled,
  photoChallengeEnabled,
  setPhotoChallengeEnabled,
  isLoading,
  hasChanges,
  onSave,
  onDirty,
  highlightFeature,
}: FeaturesTabProps) {
  useEffect(() => {
    if (!highlightFeature) {
      return;
    }

    const highlightedEl = document.getElementById(`feature-toggle-${highlightFeature}`);
    highlightedEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightFeature]);

  const getCardClasses = (feature: SettingsFeatureHighlight) =>
    clsx(
      'flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors',
      highlightFeature === feature && 'ring-2 ring-violet-500 ring-offset-2 dark:ring-violet-400 dark:ring-offset-gray-900'
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Event Features
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enable or disable features for your event
          </p>
        </div>
        {hasChanges && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Unsaved changes
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label id="feature-toggle-lucky_draw" className={getCardClasses('lucky_draw')}>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Lucky Draw
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Allow guests to enter photos into draws
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={luckyDrawEnabled}
            onChange={(event) => { setLuckyDrawEnabled(event.target.checked); onDirty(); }}
            className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
          />
        </label>

        <label id="feature-toggle-attendance" className={getCardClasses('attendance')}>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Attendance Check-in
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Allow guests to check in to the event
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={attendanceEnabled}
            onChange={(event) => { setAttendanceEnabled(event.target.checked); onDirty(); }}
            className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
          />
        </label>

        <label id="feature-toggle-photo_challenge" className={getCardClasses('photo_challenge')}>
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Photo Challenge
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Motivate guests with photo goals
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={photoChallengeEnabled}
            onChange={(event) => { setPhotoChallengeEnabled(event.target.checked); onDirty(); }}
            className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
          />
        </label>

        <label id="feature-toggle-guest_download" className={getCardClasses('guest_download')}>
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Photo Downloads
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Guests can download photos
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={guestDownloadEnabled}
            onChange={(event) => { setGuestDownloadEnabled(event.target.checked); onDirty(); }}
            className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
          />
        </label>

        <label id="feature-toggle-moderation" className={getCardClasses('moderation')}>
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Photo Moderation
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Require approval before showing photos
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={moderationRequired}
            onChange={(event) => { setModerationRequired(event.target.checked); onDirty(); }}
            className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
          />
        </label>

        <label id="feature-toggle-anonymous" className={getCardClasses('anonymous')}>
          <div className="flex items-center gap-3">
            <Hash className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Anonymous Uploads
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Allow guests to upload without name
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={anonymousAllowed}
            onChange={(event) => { setAnonymousAllowed(event.target.checked); onDirty(); }}
            className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isLoading || !hasChanges}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isLoading || !hasChanges ? 'bg-gray-400' : 'bg-violet-600 hover:bg-violet-700'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
