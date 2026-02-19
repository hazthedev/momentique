// ============================================
// Galeria - QR Code Display Component
// ============================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, Copy, Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { toPng } from 'html-to-image';

interface QRCodeDisplayProps {
  url: string;
  eventName?: string;
  size?: number;
  showDownload?: boolean;
  showShare?: boolean;
  className?: string;
}

const QR_SIZE = 200;
const DOWNLOAD_SIZE = 400;

export function QRCodeDisplay({
  url,
  eventName = 'Event',
  size = QR_SIZE,
  showDownload = true,
  showShare = true,
  className,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [supportsShare, setSupportsShare] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if Web Share API is supported
    setSupportsShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[QR_CODE] Failed to copy:', error);
    }
  };

  const handleDownload = async () => {
    if (!qrRef.current) return;

    setIsDownloading(true);
    try {
      // Create a temporary larger container for download
      const dataUrl = await toPng(qrRef.current, {
        width: DOWNLOAD_SIZE,
        height: DOWNLOAD_SIZE + 80,
        canvasWidth: DOWNLOAD_SIZE,
        canvasHeight: DOWNLOAD_SIZE + 80,
        backgroundColor: '#ffffff',
      });

      // Trigger download
      const link = document.createElement('a');
      link.download = `${eventName.replace(/\s+/g, '-')}-qrcode.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[QR_CODE] Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventName,
          text: `Join ${eventName} and share your photos!`,
          url,
        });
      } catch (error) {
        console.error('[QR_CODE] Share failed:', error);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      {/* QR Code Container */}
      <div className="relative rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-900/5">
        {/* Hidden ref for download */}
        <div className="hidden">
          <div
            ref={qrRef}
            className="flex flex-col items-center bg-white p-8"
            style={{ width: DOWNLOAD_SIZE }}
          >
            <h3 className="mb-4 text-center text-xl font-bold text-gray-900">{eventName}</h3>
            <QRCodeSVG value={url} size={DOWNLOAD_SIZE - 64} level="M" />
            <p className="mt-4 text-center text-sm text-gray-500">Scan to share photos</p>
          </div>
        </div>

        {/* Visible QR Code */}
        <div className="flex flex-col items-center">
          <QRCodeSVG value={url} size={size} level="M" />
          <p className="mt-3 text-center text-sm text-gray-500">Scan to join event</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-center gap-3">
        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'border border-gray-300 bg-white text-gray-700',
            'hover:bg-gray-50 focus:ring-gray-500',
            'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          )}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Link
            </>
          )}
        </button>

        {/* Download */}
        {showDownload && (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'border border-gray-300 bg-white text-gray-700',
              'hover:bg-gray-50 focus:ring-gray-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download
              </>
            )}
          </button>
        )}

        {/* Share */}
        {showShare && supportsShare && (
          <button
            onClick={handleShare}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'bg-gradient-to-r from-violet-600 to-pink-600 text-white',
              'hover:from-violet-700 hover:to-pink-700 focus:ring-violet-500'
            )}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        )}
      </div>

      {/* Event URL */}
      <div className="mt-4 max-w-full overflow-hidden">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Event URL:</span>{' '}
          <span className="truncate">{url}</span>
        </p>
      </div>
    </div>
  );
}

export default QRCodeDisplay;
