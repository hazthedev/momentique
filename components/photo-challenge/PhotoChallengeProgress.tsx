// ============================================
// Photo Challenge Progress Component
// ============================================
// Shows progress bar and goal status for photo challenge

'use client';

import { motion } from 'motion/react';

interface PhotoChallengeProgressProps {
  goalPhotos: number;
  photosApproved: number;
  prizeTitle: string;
  goalReached: boolean;
  themeColor: string;
  className?: string;
}

export function PhotoChallengeProgress({
  goalPhotos,
  photosApproved,
  prizeTitle,
  goalReached,
  themeColor,
  className,
}: PhotoChallengeProgressProps) {
  const progress = Math.min(photosApproved / goalPhotos, 1);
  const remaining = Math.max(goalPhotos - photosApproved, 0);

  return (
    <div
      className={`rounded-lg border p-3 ${className || ''}`}
      style={{
        borderColor: `${themeColor}40`,
        backgroundColor: `${themeColor}10`,
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: themeColor }}>
          📸 Photo Challenge
        </span>
        <span className="text-xs text-gray-500">
          {photosApproved}/{goalPhotos} photos
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className="h-2 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: `${themeColor}20` }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="h-full"
          style={{ backgroundColor: themeColor }}
        />
      </div>

      {/* Progress Message */}
      <p className="mt-2 text-center text-sm text-gray-600">
        {goalReached ? (
          <span className="font-semibold" style={{ color: themeColor }}>
            🎉 You've reached {goalPhotos} photos! You can claim: {prizeTitle}
          </span>
        ) : (
          <>
            {remaining === 1 ? (
              <span>Just {remaining} more photo to claim your prize!</span>
            ) : remaining <= 3 ? (
              <span>{remaining} more photos to claim your prize!</span>
            ) : (
              <span>{remaining} photos to go...</span>
            )}
          </>
        )}
      </p>
    </div>
  );
}