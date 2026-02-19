// ============================================
// Galeria - Lucky Draw Entry Form
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { useLuckyDraw } from '@/lib/realtime/client';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

// ============================================
// TYPE DECLARATIONS
// ============================================

interface LuckyDrawEntryFormProps {
  eventId: string;
  onSuccess?: () => void;
}

export function LuckyDrawEntryForm({ eventId, onSuccess }: LuckyDrawEntryFormProps) {
  const [formData, setFormData] = useState({
    participant_name: '',
    selfie_url: '',
    contact_info: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { submitEntry, entries } = useLuckyDraw(eventId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validation
    if (!formData.participant_name || !formData.selfie_url) {
      alert('Please enter your name and upload a selfie photo');
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit entry
      await submitEntry(
        formData.participant_name,
        formData.selfie_url,
        formData.contact_info
      );

      // Reset form
      setFormData({
        participant_name: '',
        selfie_url: '',
        contact_info: '',
      });
      setSelfiePreview(null);

      onSuccess?.();
    } catch (error) {
      console.error('[LuckyDrawEntry] Error submitting entry:', error);
      alert('Failed to submit entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement> | { file: File }) => {
    const file = 'target' in e ? e.target.files?.[0] : e.file;
    if (file) {
      // Create preview
      const url = URL.createObjectURL(file);
      setSelfiePreview(url);
    }
  };

  const removeImage = () => {
    if (selfiePreview) {
      URL.revokeObjectURL(selfiePreview);
      setSelfiePreview(null);
    }
  };

  // Check if user has already entered
  const hasEntered = entries.some((entry: { participant_name: string }) =>
    entry.participant_name === formData.participant_name
  );

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-xl p-8">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Enter Lucky Draw! 🎲
        </h3>
        {hasEntered && (
          <p className="text-sm text-yellow-600 mb-4">
            You have already entered. Good luck! 🍀
          </p>
        )}
      </div>

      {!hasEntered && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selfie Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Selfie Photo * (Face must be visible)
            </label>
            <div className="flex flex-col gap-2">
              {selfiePreview ? (
                <div className="relative w-32 h-32">
                  <Image
                    src={selfiePreview}
                    alt="Selfie preview"
                    fill
                    className="rounded-full object-cover"
                    width={128}
                    height={128}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      removeImage();
                    }}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 flex flex flex-col items-center justify-center",
                    dragActive && "border-purple-500 bg-purple-50",
                    "hover:bg-gray-50 hover:border-purple-300"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      handlePhotoSelect({ file });
                    }
                  }}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('file-upload')?.click();
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      📷 Take Photo
                    </button>
                    <label
                      htmlFor="file-upload"
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm cursor-pointer"
                    >
                      🖼️ Choose Photo
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={formData.participant_name}
                onChange={(e) =>
                  setFormData({ ...formData, participant_name: e.target.value })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Contact Info (Optional) */}
            <div>
              <label htmlFor="contact_info" className="block text-sm font-medium text-gray-700">
                Phone or Email (for winner notification)
              </label>
              <input
                id="contact_info"
                type="text"
                placeholder="+1 (555) 123-4567"
                value={formData.contact_info}
                onChange={(e) =>
                  setFormData({ ...formData, contact_info: e.target.value })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="agreement"
              required
              defaultChecked={false}
              className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="agreement" className="ml-2 text-sm text-gray-700">
              I agree to be shown on screen if I win
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !formData.participant_name || !formData.selfie_url}
            className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Entry'}
          </button>

          {/* Terms Note */}
          <p className="mt-4 text-xs text-gray-500">
            By submitting, you agree to share your photo publicly with other guests. Entry must be
            verified by the organizer.
          </p>
        </form>
      )}
    </div>
  );
}

// ============================================
// LUCKY DRAW STATS (Admin)
// ============================================

interface LuckyDrawStatsProps {
  eventId: string;
}

export function LuckyDrawStats({ eventId }: LuckyDrawStatsProps) {
  const [stats, setStats] = useState<{
    totalEntries: number;
  }>({ totalEntries: 0 });

  useEffect(() => {
    // Fetch stats from API
    fetch(`/api/events/${eventId}/lucky-draw/entries`)
      .then((res) => res.json())
      .then((data) => {
        setStats({ totalEntries: data.pagination?.total || 0 });
      });
  }, [eventId]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Lucky Draw Stats</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Entries</p>
          <p className="text-3xl font-bold text-purple-900">
            {stats.totalEntries || 0}
          </p>
        </div>
        <div className="bg-pink-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Active Participants</p>
          <p className="text-3xl font-bold text-pink-900">
            {stats.totalEntries || 0}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Recent Entries
        </h4>
        <div className="space-y-2">
          <p className="text-sm text-gray-500 italic">
            Entries will appear here in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// WINNER DISPLAY COMPONENT
// ============================================

interface WinnerDisplayProps {
  winner: {
    participant_name: string;
    selfie_url: string;
    prize_tier: number;
    entry_id: string;
  };
}

export function WinnerDisplay({ winner }: WinnerDisplayProps) {
  const [showConfetti] = useState(true);

  useEffect(() => {
    // Trigger confetti animation
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
    };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50;
      const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366f1'];

      confetti({
        ...defaults,
        particleCount,
        colors,
        origin: { x: randomInRange(0.2, 0.8), y: Math.random() * 0.3 + 0.1 },
        angle: randomInRange(0, 360),
        spread: randomInRange(50, 70),
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
      <div className="bg-white rounded-2xl p-12 shadow-2xl border-4 border-purple-500 max-w-2xl mx-4">
        {/* Winner Badge */}
        <div className="absolute -top-2 -left-2 bg-purple-500 text-white px-3 py-1 text-sm font-semibold rounded-full">
          WINNER
        </div>

        {/* Selfie */}
        {winner.selfie_url ? (
          <div className="flex justify-center mb-6">
            <Image
              src={winner.selfie_url}
              alt={winner.participant_name}
              width={200}
              height={200}
              className="rounded-full border-4 border-purple-500"
            />
          </div>
        ) : (
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-purple-500 rounded-full" />
          </div>
        )}

        {/* Winner Name */}
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-2">
          {winner.participant_name}
        </h2>

        {/* Prize Tier */}
        <div className="text-center mb-6">
          {winner.prize_tier === 1 ? '🥇' : ''}
          {winner.prize_tier === 2 ? '🥈' : ''}
          {winner.prize_tier === 3 ? '🥉' : ''}
          {winner.prize_tier === 4 ? '🏅' : ''}
        </div>

        {/* Confetti */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[10000]">
            {/* Confetti handled by effect component */}
          </div>
        )}

        {/* Congratulations Message */}
        <div className="text-center mb-8">
          <p className="text-2xl font-semibold text-gray-700 mb-2">
            Congratulations!
          </p>
          <p className="text-lg text-gray-600 mb-4">
            Your entry has been selected!
          </p>
        </div>

        {/* Timestamp */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
