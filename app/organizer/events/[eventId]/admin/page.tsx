// ============================================
// MOMENTIQUE - Event Admin Dashboard Page
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  QrCode,
  Users,
  Image as ImageIcon,
  Shield,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { EventStats } from '@/components/events/event-stats';
import QRCodeDisplay from '@/components/events/qr-code-display';
import { LuckyDrawAdminTab } from '@/components/lucky-draw/admin/LuckyDrawAdminTab';
import EventFormComponent from '@/components/events/event-form';
import EventSettingsForm from '@/components/events/event-settings-form';
import { toast } from 'sonner';
import type { IEvent } from '@/lib/types';

export default function EventAdminPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'qr' | 'lucky_draw' | 'settings' | 'moderation'>('overview');
  const [moderationLogs, setModerationLogs] = useState<Array<{
    id: string;
    photoId: string;
    action: string;
    reason: string | null;
    createdAt: string;
    moderatorName: string | null;
    moderatorEmail: string;
    photoStatus: string | null;
    imageUrl: string | null;
  }>>([]);

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
        console.error('[EVENT_ADMIN] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (activeTab !== 'moderation') return;

    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/moderation-logs?limit=10`, {
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
          setModerationLogs(data.data || []);
        }
      } catch (err) {
        console.error('[EVENT_ADMIN] Failed to fetch moderation logs:', err);
      }
    };

    fetchLogs();
  }, [activeTab, eventId]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: ImageIcon },
    { id: 'lucky_draw' as const, label: 'Lucky Draw', icon: Sparkles },
    { id: 'qr' as const, label: 'QR Code', icon: QrCode },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    { id: 'moderation' as const, label: 'Moderation', icon: Shield },
  ];

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
            href={`/organizer/events/${eventId}`}
            className="mt-4 inline-block text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  const shortLink = typeof window !== 'undefined'
    ? `${window.location.origin}/e/${event.short_code || event.id}`
    : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/organizer/events/${eventId}`}
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {event.name}
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Admin Dashboard</p>
            </div>
            <Link
              href={`/organizer/events/${eventId}/edit`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Settings className="mr-2 h-4 w-4" />
              Edit Event
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-8 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-violet-500 text-violet-600 dark:border-violet-400 dark:text-violet-400'
                      : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {activeTab === 'lucky_draw' && (
            <div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Lucky Draw Management
              </h2>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Configure prize tiers, view entries, execute draws, and announce winners
              </p>
              <LuckyDrawAdminTab eventId={eventId} />
            </div>
          )}

          {activeTab === 'overview' && (
            <div>
              <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Event Overview
              </h2>
              <EventStats eventId={eventId} refreshInterval={30000} />
            </div>
          )}

          {activeTab === 'qr' && (
            <div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                QR Code for Event Sharing
              </h2>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Share this QR code with guests to let them easily upload photos to your event
              </p>
              <QRCodeDisplay
                url={shortLink}
                eventName={event.name}
                size={300}
              />

              {/* Shareable Links */}
              <div className="mt-8 space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Short Link (Easy to Share)
                  </h3>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700">
                    <input
                      type="text"
                      readOnly
                      value={shortLink}
                      className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shortLink);
                      }}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Event Settings
              </h2>
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                    Event Details
                  </h3>
                  <EventFormComponent
                    event={event}
                    submitLabel="Save Details"
                    onSuccess={(updatedEvent) => {
                      toast.success('Event updated successfully');
                      setEvent(updatedEvent);
                    }}
                    onCancel={() => router.push(`/organizer/events/${eventId}/admin`)}
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <EventSettingsForm
                    event={event}
                    onSuccess={(updatedEvent) => {
                      setEvent(updatedEvent);
                      toast.success('Settings updated successfully');
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'moderation' && (
            <div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Photo Moderation
              </h2>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Review and approve or reject pending photo uploads
              </p>

              <Link
                href={`/organizer/events/${eventId}/photos?status=pending`}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                View Pending Photos
              </Link>

              {moderationLogs.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recent Moderation Activity
                  </h3>
                  <div className="space-y-3">
                    {moderationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                            {log.imageUrl ? (
                              <img
                                src={log.imageUrl}
                                alt="Moderated"
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-gray-400">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {(() => {
                                const statusRaw = (log.photoStatus || log.action || '').toLowerCase();
                                if (statusRaw === 'approve') return 'Approved';
                                if (statusRaw === 'reject') return 'Rejected';
                                return statusRaw
                                  ? `${statusRaw.charAt(0).toUpperCase()}${statusRaw.slice(1)}`
                                  : 'Updated';
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
