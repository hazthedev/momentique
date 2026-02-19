// ============================================
// Galeria - Edit Event Page
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EventFormComponent from '@/components/events/event-form';
import EventSettingsForm from '@/components/events/event-settings-form';
import type { IEvent } from '@/lib/types';

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load event');
        }

        setEvent(data.data);
        setError(null);
      } catch (err) {
        console.error('[EDIT_EVENT] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
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

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error || 'Event not found'}</p>
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
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/organizer/events/${eventId}/admin`}
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Event</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Update event details and settings
          </p>
        </div>

        {/* Event Details Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Event Details
          </h2>
          <EventFormComponent
            event={event}
            submitLabel="Save Changes"
            onSuccess={(updatedEvent) => {
              toast.success('Event updated successfully');
              setEvent(updatedEvent);
            }}
            onCancel={() => router.push(`/organizer/events/${eventId}/admin`)}
          />
        </div>

        {/* Theme & Settings Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <EventSettingsForm
            event={event}
            onSuccess={(updatedEvent) => {
              setEvent(updatedEvent);
            }}
          />
        </div>
      </div>
    </div>
  );
}

