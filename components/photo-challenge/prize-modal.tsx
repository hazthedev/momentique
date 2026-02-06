// ============================================
// Photo Challenge Prize Modal Component
// ============================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { Gift, X, Download, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import type { IPhotoChallenge, IGuestPhotoProgress } from '@/lib/types';
import { getClientFingerprint } from '@/lib/fingerprint';

interface PhotoChallengePrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: IPhotoChallenge;
  progress: IGuestPhotoProgress;
  eventId: string;
  tenantId?: string;
  themePrimary: string;
  themeSecondary: string;
  themeSurface: string;
  surfaceText: string;
  surfaceMuted: string;
}

const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

export function PhotoChallengePrizeModal({
  isOpen,
  onClose,
  challenge,
  progress,
  eventId,
  tenantId,
  themePrimary,
  themeSecondary,
  themeSurface,
  surfaceText,
  surfaceMuted,
}: PhotoChallengePrizeModalProps) {
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !claimToken) {
      generateClaimToken();
    }
  }, [isOpen]);

  const generateClaimToken = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fingerprint = getClientFingerprint();
      if (!fingerprint) {
        throw new Error('Unable to identify user');
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      headers['x-fingerprint'] = fingerprint;
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const response = await fetch(`/api/events/${eventId}/photo-challenge/claim`, {
        method: 'POST',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate prize claim');
      }

      setClaimToken(data.data.claim_token);
    } catch (err) {
      console.error('[PRIZE_MODAL] Failed to generate claim token:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate prize claim');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `prize-qr-${progress.event_id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const qrCodeUrl = claimToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/claim/${claimToken}` : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
          >
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{ backgroundColor: themeSurface }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 hover:opacity-80"
                style={{ color: surfaceMuted }}
              >
                <X className="h-5 w-5" />
              </button>

              {/* Celebration Icon */}
              <div className="mb-4 flex justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${themePrimary}, ${themeSecondary})`,
                  }}
                >
                  <Gift className="h-8 w-8 text-white" />
                </motion.div>
              </div>

              {/* Title */}
              <h3 className="mb-2 text-center text-xl font-bold" style={{ color: surfaceText }}>
                Congratulations! 🎉
              </h3>

              {/* Description */}
              <p className="mb-4 text-center text-sm" style={{ color: surfaceMuted }}>
                You&apos;ve reached the photo challenge goal and unlocked a prize!
              </p>

              {/* Prize Details */}
              <div className="mb-6 rounded-lg border p-4" style={{ borderColor: `${themePrimary}30` }}>
                <h4 className="mb-1 text-base font-semibold" style={{ color: surfaceText }}>
                  {challenge.prize_title}
                </h4>
                {challenge.prize_description && (
                  <p className="text-sm" style={{ color: surfaceMuted }}>
                    {challenge.prize_description}
                  </p>
                )}
              </div>

              {/* QR Code */}
              {isLoading ? (
                <div className="mb-6 flex flex-col items-center">
                  <div className="h-48 w-48 animate-pulse rounded-lg" style={{ backgroundColor: `${themePrimary}20` }} />
                  <p className="mt-3 text-sm" style={{ color: surfaceMuted }}>Generating your prize QR code...</p>
                </div>
              ) : error ? (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-800">
                  {error}
                </div>
              ) : claimToken ? (
                <div className="mb-6 flex flex-col items-center">
                  <div
                    ref={qrRef}
                    className="mb-4 overflow-hidden rounded-lg border-2 bg-white p-3"
                    style={{ borderColor: themePrimary }}
                  >
                    <QRCodeSVG
                      value={qrCodeUrl}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="mb-1 text-center text-sm" style={{ color: surfaceText }}>
                    Show this QR code to the event organizer
                  </p>
                  <p className="text-center text-xs" style={{ color: surfaceMuted }}>
                    to claim your prize
                  </p>
                </div>
              ) : null}

              {/* Actions */}
              {!isLoading && !error && claimToken && (
                <button
                  onClick={handleDownload}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: themePrimary }}
                >
                  {downloaded ? (
                    <>
                      <Check className="h-4 w-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Save QR Code
                    </>
                  )}
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition-all hover:opacity-80"
                style={{ color: surfaceMuted }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
