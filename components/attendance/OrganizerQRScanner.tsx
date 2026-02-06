// ============================================
// Gatherly - Organizer QR Scanner Component
// ============================================
// Allows organizers to scan guest QR codes and check them in

'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { motion } from 'motion/react';

interface OrganizerQRScannerProps {
  eventId: string;
  onClose?: () => void;
  onScanSuccess?: (data: string) => void;
}

export function OrganizerQRScanner({ eventId, onClose, onScanSuccess }: OrganizerQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulate QR scan for demo (in production, use react-qr-reader)
  const handleSimulatedScan = async () => {
    setIsLoading(true);
    setError(null);

    // Simulate scanning delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate a mock guest data (in production, this comes from the QR code)
    const mockGuestData = {
      guest_name: `Guest ${Math.floor(Math.random() * 1000)}`,
      guest_email: `guest${Math.floor(Math.random() * 1000)}@example.com`,
      companions_count: Math.floor(Math.random() * 3),
    };

    try {
      const response = await fetch(`/api/events/${eventId}/attendance/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mockGuestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      setLastScanned(mockGuestData.guest_name);
      toast.success(`${mockGuestData.guest_name} checked in successfully!`);
      onScanSuccess?.(mockGuestData.guest_name);

      // Auto-clear success message after 3 seconds
      setTimeout(() => setLastScanned(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Check-in failed';
      setError(errorMessage);
      toast.error(errorMessage);
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Scanner Viewport */}
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        {/* Camera Placeholder */}
        <div className="flex aspect-[4/3] flex-col items-center justify-center p-8">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
            </motion.div>
          )}

          {lastScanned && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              <CheckCircle className="h-4 w-4" />
              {lastScanned} checked in!
            </motion.div>
          )}

          <div className="text-center">
            <div
              className={clsx(
                'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full',
                isScanning ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-10 w-10 animate-spin" />
              ) : isScanning ? (
                <Camera className="h-10 w-10" />
              ) : (
                <CameraOff className="h-10 w-10" />
              )}
            </div>

            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              QR Code Scanner
            </h3>

            {isScanning ? (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Position the guest's QR code within the frame
              </p>
            ) : (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Click "Start Scanner" to begin scanning guest QR codes
              </p>
            )}

            {/* Demo Controls */}
            <div className="mt-6 space-y-3">
              {!isScanning ? (
                <button
                  onClick={() => setIsScanning(true)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Camera className="h-5 w-5" />
                  Start Scanner
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSimulatedScan}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Simulate QR Scan (Demo)
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setIsScanning(false)}
                    className="block w-full rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Stop Scanner
                  </button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 rounded-lg bg-blue-50 p-4 text-left dark:bg-blue-900/20">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">
                Instructions:
              </p>
              <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Ask the guest to show their QR code</li>
                <li>Position the QR code within the scanner frame</li>
                <li>The system will automatically check them in</li>
                <li>Duplicate check-ins will be prevented</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Hidden video element for camera (in production) */}
        <video ref={videoRef} className="hidden" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Scan Method</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            organizer_qr
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isScanning ? 'Active' : 'Idle'}
          </p>
        </div>
      </div>
    </div>
  );
}
