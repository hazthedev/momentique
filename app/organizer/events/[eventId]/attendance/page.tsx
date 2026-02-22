// ============================================
// Galeria - Attendance Management Page
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Users } from 'lucide-react';
import { AttendanceAdminTab } from '@/components/attendance/AttendanceAdminTab';
import type { IEvent } from '@/lib/types';

export default function AttendancePage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (error) {
        console.error('Error fetching event:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Event not found</p>
          <Link
            href={`/organizer/events/${eventId}/admin`}
            className="mt-4 inline-block text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/organizer/events/${eventId}/admin`}
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Attendance Management
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage check-ins, view guest lists, and generate QR codes
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {event.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {event.settings?.features?.attendance_enabled !== false ? 'Attendance enabled' : 'Attendance disabled'}
              </p>
            </div>
          </div>

          <AttendanceAdminTab
            eventId={eventId}
            attendanceEnabled={event.settings?.features?.attendance_enabled !== false}
            settingsFeaturesHref={`/organizer/events/${eventId}/admin?tab=settings&subTab=features&feature=attendance`}
          />
        </div>
      </div>
    </div>
  );
}
