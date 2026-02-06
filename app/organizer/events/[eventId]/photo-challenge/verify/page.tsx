// ============================================
// Photo Challenge Prize Verification Page
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QrCode, Check, X, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function PhotoChallengeVerifyPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [tokenInput, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [claimData, setClaimData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    const token = tokenInput.trim();
    if (!token) {
      toast.error('Please enter a claim token');
      return;
    }

    setIsLoading(true);
    setError(null);
    setClaimData(null);

    try {
      const response = await fetch(`/api/events/${eventId}/photo-challenge/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setClaimData(data.data);
      toast.success('Prize claim verified!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!claimData?.user_fingerprint) return;

    if (!confirm('Are you sure you want to revoke this prize?')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/photo-challenge/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_fingerprint: claimData.user_fingerprint,
          reason: 'Revoked by organizer',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke prize');
      }

      toast.success('Prize revoked successfully');
      setClaimData(null);
      setTokenInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke prize');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            ← Back to Admin
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Prize Verification
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scan QR code or enter token to verify prize claims
              </p>
            </div>
          </div>
        </div>

        {/* Token Input */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Claim Token
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Enter 16-character token from QR code"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={handleVerify}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-6 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Verify
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <X className="h-5 w-5" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Claim Data */}
        {claimData && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Prize Claim Details
              </h3>
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 dark:bg-emerald-900/30">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                  Verified
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Prize</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {claimData.prize_title}
                </p>
                {claimData.prize_description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {claimData.prize_description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Photos Uploaded</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {claimData.photos_approved}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Goal</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {claimData.goal_photos}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Guest ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {claimData.user_fingerprint?.slice(0, 16)}...
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Claimed At</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(claimData.claimed_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setClaimData(null);
                  setTokenInput('');
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear
              </button>
              <button
                onClick={handleRevoke}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Revoke Prize
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!claimData && (
          <div className="mt-8 rounded-xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/20">
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
              How to verify prizes
            </h3>
            <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-semibold text-violet-800 dark:bg-violet-800 dark:text-violet-200">
                  1
                </span>
                <span>Ask the guest to show their prize QR code from the event page</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-semibold text-violet-800 dark:bg-violet-800 dark:text-violet-200">
                  2
                </span>
                <span>Scan the QR code or enter the 16-character token manually</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-semibold text-violet-800 dark:bg-violet-800 dark:text-violet-200">
                  3
                </span>
                <span>Verify the prize details and hand over the prize to the guest</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
