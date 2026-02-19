// ============================================
// Galeria - Lucky Draw Animation Components
// ============================================

'use client';

import { SlotMachineAnimation } from '@/components/lucky-draw/SlotMachineAnimation';

interface DrawAnimationProps {
  style: string;
  durationSeconds: number;
  prizeName?: string;
  participantName?: string;
  photoUrl?: string | null;
  numberString?: string;
  showSelfie?: boolean;
  showFullName?: boolean;
  entries?: Array<{ participantName?: string | null; id: string }>;
  onComplete: () => void;
  playSound?: boolean;
}

export function DrawAnimation({
  durationSeconds,
  prizeName,
  participantName,
  photoUrl,
  numberString,
  showSelfie = true,
  showFullName = true,
  onComplete,
}: DrawAnimationProps) {
  return (
    <SlotMachineAnimation
      durationSeconds={durationSeconds}
      prizeName={prizeName}
      participantName={participantName}
      photoUrl={photoUrl}
      numberString={numberString || '----'}
      onComplete={onComplete}
      showSelfie={showSelfie}
      showFullName={showFullName}
    />
  );
}
