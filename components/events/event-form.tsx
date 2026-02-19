// ============================================
// Galeria - Event Form Component
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Calendar, MapPin, Hash, Users, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import type { IEvent, EventType, EventStatus } from '@/lib/types';

interface EventFormData {
  name: string;
  description: string;
  event_type: EventType;
  event_date: string;
  location: string;
  expected_guests: string;
  custom_hashtag: string;
  short_code: string;
  status: EventStatus;
}

interface EventFormProps {
  event?: IEvent;
  onSuccess?: (event: IEvent) => void;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

const eventTypes: { value: EventType; label: string; description: string }[] = [
  { value: 'birthday', label: 'Birthday', description: 'Celebrate a special day' },
  { value: 'wedding', label: 'Wedding', description: 'Capture the big day moments' },
  { value: 'corporate', label: 'Corporate', description: 'Company events and meetings' },
  { value: 'other', label: 'Other', description: 'Any other type of event' },
];

const statusOptions: { value: EventStatus; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Not yet visible to participants' },
  { value: 'active', label: 'Active', description: 'Open for photo uploads' },
  { value: 'ended', label: 'Ended', description: 'Event has concluded' },
  { value: 'archived', label: 'Archived', description: 'Historical record only' },
];

const initialFormData: EventFormData = {
  name: '',
  description: '',
  event_type: 'other',
  event_date: '',
  location: '',
  expected_guests: '',
  custom_hashtag: '',
  short_code: '',
  status: 'active',
};

export function EventForm({
  event,
  onSuccess,
  onCancel,
  submitLabel = event ? 'Update Event' : 'Create Event',
  className,
}: EventFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || '',
        description: event.description || '',
        event_type: event.event_type,
        event_date: new Date(event.event_date).toISOString().split('T')[0],
        location: event.location || '',
        expected_guests: event.expected_guests?.toString() || '',
        custom_hashtag: event.custom_hashtag || '',
        short_code: event.short_code || '',
        status: event.status,
      });
    }
  }, [event]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Event name is required';
    }

    if (!formData.event_date) {
      newErrors.event_date = 'Event date is required';
    } else {
      const eventDate = new Date(formData.event_date);
      if (eventDate < new Date('2000-01-01')) {
        newErrors.event_date = 'Please enter a valid date';
      }
    }

    if (formData.expected_guests && (parseInt(formData.expected_guests) < 1 || parseInt(formData.expected_guests) > 100000)) {
      newErrors.expected_guests = 'Please enter a number between 1 and 100,000';
    }

    if (formData.custom_hashtag && !/^[a-zA-Z0-9_]+$/.test(formData.custom_hashtag)) {
      newErrors.custom_hashtag = 'Hashtag can only contain letters, numbers, and underscores';
    }

    if (formData.short_code.trim()) {
      const shortCode = formData.short_code.trim().toLowerCase();
      if (!/^[a-z0-9-]{3,20}$/.test(shortCode)) {
        newErrors.short_code = 'URL code must be 3-20 characters (letters, numbers, hyphens)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const url = event ? `/api/events/${event.id}` : '/api/events';
      const method = event ? 'PATCH' : 'POST';

      // Use session-based authentication (cookies)
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send cookies with the request
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          event_type: formData.event_type,
          event_date: new Date(formData.event_date).toISOString(),
          location: formData.location.trim() || undefined,
          expected_guests: formData.expected_guests ? parseInt(formData.expected_guests) : undefined,
          custom_hashtag: formData.custom_hashtag.trim() || undefined,
          short_code: formData.short_code.trim() ? formData.short_code.trim().toLowerCase() : undefined,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setApiError(data.error || data.message || 'Failed to save event');
        setIsLoading(false);
        return;
      }

      // Show success state
      setIsSuccess(true);

      // Call onSuccess callback if provided (parent handles redirect)
      if (onSuccess) {
        onSuccess(data.data);
        // Delay redirect slightly to show success message
        setTimeout(() => {
          router.push(`/organizer/events/${data.data.id}`);
        }, 500);
      } else {
        // No onSuccess callback, handle redirect here
        setTimeout(() => {
          router.push(`/organizer/events/${data.data.id}`);
        }, 500);
      }
    } catch (error) {
      console.error('[EVENT_FORM] Error:', error);
      setApiError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof EventFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={clsx('space-y-6', className)}>
      {/* Success Message */}
      {isSuccess && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Event {event ? 'updated' : 'created'} successfully!</p>
            <p className="text-xs opacity-75">Redirecting to event page...</p>
          </div>
        </div>
      )}

      {/* API Error */}
      {apiError && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          {apiError}
        </div>
      )}

      {/* Event Name */}
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Event Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={e => handleInputChange('name', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.name,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.name,
            }
          )}
          placeholder="My Amazing Event"
          disabled={isLoading}
        />
        {errors.name && <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
      </div>

      {/* Event Type */}
      <div className="space-y-1.5">
        <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Event Type <span className="text-red-500">*</span>
        </label>
        <select
          id="event_type"
          value={formData.event_type}
          onChange={e => handleInputChange('event_type', e.target.value as EventType)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          disabled={isLoading}
        >
          {eventTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label} - {type.description}
            </option>
          ))}
        </select>
      </div>

      {/* Custom URL Code (short link) */}
      {event && (
        <div className="space-y-1.5">
          <label htmlFor="short_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Custom URL Code
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
              /e/
            </span>
            <input
              id="short_code"
              type="text"
              value={formData.short_code}
              onChange={e => handleInputChange('short_code', e.target.value)}
              className={clsx(
                'block w-full rounded-r-lg border px-4 py-2.5 text-sm',
                'transition-colors duration-200',
                'placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                {
                  'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                    !errors.short_code,
                  'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                    errors.short_code,
                }
              )}
              placeholder="birthday-papa"
              disabled={isLoading}
            />
          </div>
          {errors.short_code && <p className="text-sm text-red-600 dark:text-red-400">{errors.short_code}</p>}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Letters, numbers, and hyphens only. Changing this breaks old links.
          </p>
        </div>
      )}

      {/* Event Date */}
      <div className="space-y-1.5">
        <label htmlFor="event_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Event Date <span className="text-red-500">*</span>
          </span>
        </label>
        <input
          id="event_date"
          type="date"
          value={formData.event_date}
          onChange={e => handleInputChange('event_date', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.event_date,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.event_date,
            }
          )}
          disabled={isLoading}
        />
        {errors.event_date && <p className="text-sm text-red-600 dark:text-red-400">{errors.event_date}</p>}
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            Location
          </span>
        </label>
        <input
          id="location"
          type="text"
          value={formData.location}
          onChange={e => handleInputChange('location', e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="Venue name or address"
          disabled={isLoading}
        />
      </div>

      {/* Expected Guests */}
      <div className="space-y-1.5">
        <label htmlFor="expected_guests" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Expected Guests
          </span>
        </label>
        <input
          id="expected_guests"
          type="number"
          min="1"
          max="100000"
          value={formData.expected_guests}
          onChange={e => handleInputChange('expected_guests', e.target.value)}
          className={clsx(
            'block w-full rounded-lg border px-4 py-2.5 text-sm',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            {
              'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                !errors.expected_guests,
              'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                errors.expected_guests,
            }
          )}
          placeholder="50"
          disabled={isLoading}
        />
        {errors.expected_guests && <p className="text-sm text-red-600 dark:text-red-400">{errors.expected_guests}</p>}
      </div>

      {/* Custom Hashtag */}
      <div className="space-y-1.5">
        <label htmlFor="custom_hashtag" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <Hash className="h-4 w-4" />
            Custom Hashtag
          </span>
        </label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
            #
          </span>
          <input
            id="custom_hashtag"
            type="text"
            value={formData.custom_hashtag}
            onChange={e => handleInputChange('custom_hashtag', e.target.value)}
            className={clsx(
              'block w-full rounded-r-lg border px-4 py-2.5 text-sm',
              'transition-colors duration-200',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              {
                'border-gray-300 bg-white text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100':
                  !errors.custom_hashtag,
                'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/10 dark:text-red-200':
                  errors.custom_hashtag,
              }
            )}
            placeholder="myevent"
            disabled={isLoading}
          />
        </div>
        {errors.custom_hashtag && <p className="text-sm text-red-600 dark:text-red-400">{errors.custom_hashtag}</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Letters, numbers, and underscores only
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description}
          onChange={e => handleInputChange('description', e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="Tell us about your event..."
          disabled={isLoading}
        />
      </div>

      {/* Status (only for editing) */}
      {event && (
        <div className="space-y-1.5">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={e => handleInputChange('status', e.target.value as EventStatus)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            disabled={isLoading}
          >
            {statusOptions.map(status => (
              <option key={status.value} value={status.value}>
                {status.label} - {status.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className={clsx(
            'flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            {
              'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-700 hover:to-pink-700 focus:ring-violet-500':
                !isLoading,
              'bg-gray-400': isLoading,
            }
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}

export default EventForm;
