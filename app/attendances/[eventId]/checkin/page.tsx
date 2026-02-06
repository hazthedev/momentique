// ============================================
// Gatherly - Attendance Check-in Page (QR Code Destination)
// ============================================
// This page is accessed by scanning a QR code or direct link

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, Mail, Phone, Users, Loader2, Calendar, MapPin, Info } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import type { IEvent } from '@/lib/types';
import { CheckInModal } from '@/components/attendance/CheckInModal';

export default function AttendanceCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Event not found');
        }

        const data = await response.json();
        setEvent(data.data);

        // Check if attendance is enabled
        if (data.data.settings?.features?.attendance_enabled === false) {
          router.push(`/e/${eventId}`);
          toast.error('Attendance is not enabled for this event');
          return;
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        toast.error('Failed to load event');
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId, router]);

  const attendanceEnabled = event?.settings?.features?.attendance_enabled !== false;

  // If event is loaded but attendance is disabled, redirect will happen in useEffect
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  // If event doesn't exist or attendance disabled, useEffect will handle redirect
  if (!event || !attendanceEnabled) {
    return null;
  }

  const themePrimary = event.settings?.theme?.primary_color || '#10B981';
  const themeSecondary = event.settings?.theme?.secondary_color || '#14B8A6';

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-white dark:from-gray-900 dark:to-gray-800"
      style={{
        backgroundImage: `linear-gradient(135deg, ${themePrimary}15 0%, ${themeSecondary}15 50%, white 100%)`,
      }}
    >
      {/* Header */}
      <header className="border-b border-emerald-200/20 bg-white/80 backdrop-blur-sm dark:border-emerald-800/20 dark:bg-gray-900/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {event.name}
                </h1>
                {event.event_date && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(event.event_date).toLocaleDateString()} • {event.location || 'Location TBD'}
                  </p>
                )}
              </div>
            </div>
            {!hasCheckedIn && (
              <button
                onClick={() => router.push(`/e/${eventId}`)}
                className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-400"
              >
                View Event Gallery
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Success State */}
          {hasCheckedIn ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white"
              >
                <Users className="h-10 w-10" />
              </motion.div>

              <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                You're Checked In!
              </h2>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                Thanks for checking in to {event.name}. We're looking forward to seeing you!
              </p>

              <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-800 dark:bg-gray-900">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Event Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(event.event_date).toLocaleDateString()} at {new Date(event.event_date).toLocaleTimeString()}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push(`/e/${eventId}`)}
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Go to Event Gallery
              </button>
            </div>
          ) : (
            <>
              {/* Pre-check-in State */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${themePrimary}, ${themeSecondary})`,
                  }}
                >
                  <Users className="h-10 w-10" />
                </motion.div>

                <h2 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Welcome to {event.name}!
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Please check in below to let us know you're here.
                </p>
              </div>

              {/* Info Card */}
              <div className="mb-8 rounded-xl border border-emerald-200 bg-white/80 backdrop-blur-sm p-6 shadow-lg dark:border-emerald-800/50 dark:bg-gray-900/80">
                <div className="flex items-start gap-3 mb-4">
                  <Info className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Check-in Information
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Please provide your name to check in. Email and phone are optional but help prevent duplicate check-ins.
                    </p>
                  </div>
                </div>
              </div>

              {/* Check-in Button */}
              <div className="flex justify-center">
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${themePrimary}, ${themeSecondary})`,
                  }}
                >
                  <Users className="h-6 w-6" />
                  Check In Now
                </button>
              </div>

              {/* Event Details */}
              <div className="mt-8 rounded-xl border border-emerald-200 bg-white/60 backdrop-blur-sm p-6 shadow-sm dark:border-emerald-800/50 dark:bg-gray-900/60">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Event Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(event.event_date).toLocaleDateString()} at {new Date(event.event_date).toLocaleTimeString()}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.description && (
                    <p className="mt-3 text-gray-600 dark:text-gray-400 italic">
                      "{event.description}"
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-200/50 bg-white/60 backdrop-blur-sm py-4 dark:border-emerald-800/30 dark:bg-gray-900/60">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Powered by Gatherly
        </div>
      </footer>

      {/* Check-in Modal */}
      <AnimatePresence>
        {showCheckInModal && (
          <CheckInModal
            eventId={eventId}
            onClose={() => setShowCheckInModal(false)}
            onSuccess={() => {
              setHasCheckedIn(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
