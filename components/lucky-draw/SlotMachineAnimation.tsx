// ============================================
// Galeria - Slot Machine Draw Animation
// ============================================

'use client';

import { useEffect, useMemo, useState } from 'react';

interface SlotMachineAnimationProps {
  durationSeconds: number;
  numberString: string;
  participantName?: string;
  photoUrl?: string | null;
  prizeName?: string;
  onComplete?: () => void;
  showSelfie?: boolean;
  showFullName?: boolean;
}

const CHARSET = '0123456789ABCDEF';

const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  const first = parts[0]?.[0] || '?';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  return `${first}${last}`.toUpperCase();
};

export function SlotMachineAnimation({
  durationSeconds,
  numberString,
  participantName,
  photoUrl,
  prizeName,
  onComplete,
  showSelfie = true,
  showFullName = true,
}: SlotMachineAnimationProps) {
  const target = useMemo(() => {
    const clean = numberString.replace(/\s+/g, '').toUpperCase();
    return clean.length > 0 ? clean : '----';
  }, [numberString]);

  const [display, setDisplay] = useState(target);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const durationMs = Math.max(2000, durationSeconds * 1000);
    const intervalMs = 70;
    const totalChars = target.length;

    const randomChar = () => CHARSET[Math.floor(Math.random() * CHARSET.length)];

    const interval = setInterval(() => {
      const next = Array.from({ length: totalChars }, () => randomChar()).join('');
      setDisplay(next);
    }, intervalMs);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setDisplay(target);
      setStopped(true);
      if (onComplete) {
        setTimeout(onComplete, 800);
      }
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [durationSeconds, onComplete, target]);

  return (
    <div className="flex flex-col items-center gap-6">
      {prizeName && (
        <p className="text-sm font-medium text-amber-200">
          Drawing for: <span className="font-semibold text-amber-300">{prizeName}</span>
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-950 px-6 py-8 shadow-[0_0_40px_rgba(99,102,241,0.25)]">
        <div className="flex items-center justify-center gap-3">
          {display.split('').map((char, index) => (
            <div
              key={`${char}-${index}`}
              className="flex h-16 w-12 items-center justify-center rounded-lg border border-violet-500/30 bg-slate-900 text-3xl font-black text-violet-200 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.4)]"
            >
              {char}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          {stopped ? 'Winner locked in' : 'Rolling...'}
        </p>
      </div>

      {stopped && (
        <p className="text-sm text-amber-200/80">Winner revealed</p>
      )}
    </div>
  );
}
