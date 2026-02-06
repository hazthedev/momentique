// ============================================
// Prize Claim Modal Component
// ============================================
// Shows when user reaches photo challenge goal

'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Download, Share2, X } from 'lucide-react';
import { motion as motionDiv } from 'framer-motion';

interface PrizeClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeUrl: string;
  qrCodeData: string;
  prizeTitle: string;
  prizeDescription?: string;
  eventName: string;
  themeColor: string;
  themeSecondary: string;
  surfaceText: string;
  surfaceMuted: string;
  themeSurface?: string;
}

export function PrizeClaimModal({
  isOpen,
  onClose,
  qrCodeUrl,
  qrCodeData,
  prizeTitle,
  prizeDescription,
  eventName,
  themeColor,
  themeSecondary,
  surfaceText,
  surfaceMuted,
  themeSurface,
}: PrizeClaimModalProps) {
  const handleDownload = () => {
    // Create a canvas to render QR code
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Generate a simple QR code display (placeholder)
    canvas.width = 300;
    canvas.height = 350;

    if (!ctx) {
      console.error('[PrizeClaimModal] Failed to get canvas context');
      return;
    }

    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(eventName, canvas.width / 2, 40);

    // Draw prize
    ctx.font = 'bold 16px Arial';
    ctx.fillText(prizeTitle, canvas.width / 2, 70);

    // Draw QR code placeholder (actual QR would be rendered by a library)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    const qrSize = 150;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 100;

    // Draw QR code border
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);

    // Draw QR pattern (simplified)
    const cellSize = qrSize / 10;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(qrX + i * cellSize, qrY + j * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw instructions
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('Show this QR code to the organizer', canvas.width / 2, 270);
    ctx.fillText('to claim your prize!', canvas.width / 2, 290);

    // Download
    const link = document.createElement('a');
    link.download = `prize-claim-${eventName}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Prize for ${eventName}`,
        text: `I won ${prizeTitle} at ${eventName}!`,
        url: qrCodeUrl,
      });
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(qrCodeUrl);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
          >
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{
                backgroundColor: themeSurface || '#ffffff',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: surfaceText }}>
                  🎉 Congratulations!
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" style={{ color: surfaceMuted }} />
                </button>
              </div>

              {/* Prize Info */}
              <div className="mb-6 rounded-lg p-4" style={{ backgroundColor: `${themeColor}15` }}>
                <p className="text-sm text-gray-600 mb-1">You've won:</p>
                <p className="text-xl font-bold" style={{ color: themeColor }}>
                  {prizeTitle}
                </p>
                {prizeDescription && (
                  <p className="text-sm text-gray-600 mt-1">{prizeDescription}</p>
                )}
              </div>

              {/* QR Code Display */}
              <div className="mb-6 flex flex-col items-center">
                <div className="relative bg-white p-4 rounded-lg border-2 border-gray-200">
                  {/* QR Code Placeholder */}
                  <div className="w-48 h-48 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🎁</div>
                      <p className="text-sm text-gray-600">Show this to organizer</p>
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    ✓ Verified
                  </div>
                </div>

                {/* Token (fallback) */}
                <div className="mt-2 text-xs text-gray-500 font-mono text-center break-all">
                  {qrCodeData.substring(0, 20)}...
                </div>
              </div>

              {/* Instructions */}
              <div className="mb-6 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-medium mb-1">How to claim your prize:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Take a screenshot of this QR code</li>
                  <li>Show it to the event organizer</li>
                  <li>They will verify and give you your prize!</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: themeSecondary }}
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold border transition-all hover:bg-gray-50"
                  style={{ borderColor: `${themeColor}40`, color: themeColor }}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
