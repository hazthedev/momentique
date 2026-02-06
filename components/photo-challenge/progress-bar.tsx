// ============================================
// Photo Challenge Progress Bar Component
// ============================================

'use client';

import { Target, Gift } from 'lucide-react';
import { motion } from 'motion/react';
import type { IPhotoChallenge, IGuestPhotoProgress } from '@/lib/types';

interface PhotoChallengeProgressBarProps {
  challenge: IPhotoChallenge;
  progress: IGuestPhotoProgress | null;
  themePrimary: string;
  themeSecondary: string;
  surfaceText: string;
  surfaceMuted: string;
  surfaceBorder: string;
  inputBackground: string;
}

export function PhotoChallengeProgressBar({
  challenge,
  progress,
  themePrimary,
  themeSecondary,
  surfaceText,
  surfaceMuted,
  surfaceBorder,
  inputBackground,
}: PhotoChallengeProgressBarProps) {
  const currentPhotos = progress?.photos_approved || 0;
  const goalPhotos = challenge.goal_photos;
  const progressPercent = Math.min(100, Math.round((currentPhotos / goalPhotos) * 100));
  const goalReached = progress?.goal_reached || false;
  const prizeClaimed = !!progress?.prize_claimed_at;
  const prizeRevoked = progress?.prize_revoked || false;

  // Always show progress bar, even after claiming (prize_claimed_at just marks that they claimed, but they can still see progress)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border p-4"
      style={{ borderColor: surfaceBorder, backgroundColor: inputBackground }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {goalReached ? (
            <Gift className="h-4 w-4" style={{ color: themeSecondary }} />
          ) : (
            <Target className="h-4 w-4" style={{ color: themePrimary }} />
          )}
          <span className="text-sm font-semibold" style={{ color: surfaceText }}>
            {goalReached ? 'Goal Reached!' : 'Photo Challenge'}
          </span>
        </div>
        {prizeRevoked && (
          <span className="text-xs text-red-600 dark:text-red-400">Prize revoked</span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs" style={{ color: surfaceMuted }}>
            {goalReached ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                You did it! 🎉
              </span>
            ) : (
              `${currentPhotos} / ${goalPhotos} photos`
            )}
          </span>
          <span className="text-xs font-medium" style={{ color: surfaceText }}>
            {progressPercent}%
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: surfaceBorder }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              backgroundImage: `linear-gradient(90deg, ${themePrimary}, ${themeSecondary})`,
            }}
          />
        </div>
      </div>

      {/* Prize Info */}
      {goalReached && !prizeClaimed && !prizeRevoked && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 rounded-md p-2"
          style={{
            backgroundColor: `linear-gradient(135deg, ${themePrimary}15, ${themeSecondary}15)`,
          }}
        >
          <p className="text-xs font-medium" style={{ color: surfaceText }}>
            Prize: {challenge.prize_title}
          </p>
          {challenge.prize_description && (
            <p className="mt-1 text-xs" style={{ color: surfaceMuted }}>
              {challenge.prize_description}
            </p>
          )}
        </motion.div>
      )}

      {!goalReached && (
        <p className="mt-2 text-xs" style={{ color: surfaceMuted }}>
          Upload {goalPhotos - currentPhotos} more photo{goalPhotos - currentPhotos !== 1 ? 's' : ''} to unlock:
          <span className="ml-1 font-medium" style={{ color: surfaceText }}>
            {challenge.prize_title}
          </span>
        </p>
      )}
    </motion.div>
  );
}
