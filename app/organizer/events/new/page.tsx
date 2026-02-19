// ============================================
// Galeria - Create Event Page
// ============================================

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import EventFormComponent from '@/components/events/event-form';

export default function NewEventPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/events"
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Create New Event</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Set up a new event for photo sharing and guest engagement
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <EventFormComponent
            submitLabel="Create Event"
            onSuccess={(event) => {
              // Redirect is handled in the form component
              toast.success('Event created successfully');
            }}
          />
        </div>

        {/* Help Text */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
            What happens next?
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-400">
            <li>• Your event will be created with a unique QR code for sharing</li>
            <li>• Guests can scan the code to upload photos directly</li>
            <li>• You can access the admin dashboard to manage photos and settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
