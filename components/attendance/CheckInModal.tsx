// ============================================
// Galeria - Check-in Modal Component
// ============================================

'use client';

import { useState } from 'react';
import { User, Mail, Phone, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface CheckInModalProps {
  eventId: string;
  onClose: () => void;
  onSuccess?: (attendance: unknown) => void;
}

export function CheckInModal({ eventId, onClose, onSuccess }: CheckInModalProps) {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [companionsCount, setCompanionsCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guest_name: guestName,
          guest_email: guestEmail || undefined,
          guest_phone: guestPhone || undefined,
          companions_count: companionsCount,
          check_in_method: 'guest_self',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      toast.success('Checked in successfully!');
      onSuccess?.(data.data);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Check-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Check In
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="Your name"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="email@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used to prevent duplicate check-ins
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="+1 234 567 8900"
                  disabled={isSubmitting}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Alternative to email for duplicate check
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Additional Guests
              </label>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setCompanionsCount(Math.max(0, companionsCount - 1))}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  -
                </button>
                <span className="w-12 text-center font-semibold text-gray-900 dark:text-gray-100">
                  {companionsCount}
                </span>
                <button
                  type="button"
                  onClick={() => setCompanionsCount(companionsCount + 1)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  +
                </button>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  people with you
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !guestName.trim()}
              className={clsx(
                'w-full rounded-lg py-2.5 font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSubmitting || !guestName.trim()
                  ? 'bg-gray-400'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              )}
            >
              {isSubmitting ? 'Checking in...' : 'Check In'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
