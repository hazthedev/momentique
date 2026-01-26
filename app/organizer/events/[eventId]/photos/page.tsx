// ============================================
// MOMENTIQUE - Event Photos Page
// ============================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { PhotoGallery } from '@/components/gallery/PhotoGallery';
import type { IEvent, IPhoto } from '@/lib/types';

type PhotoStatus = 'pending' | 'approved' | 'rejected' | 'all';

export default function EventPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.eventId as string;

  const [photos, setPhotos] = useState<IPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<IEvent | null>(null);
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
  const [activeStatus, setActiveStatus] = useState<PhotoStatus>(
    (searchParams.get('status') as PhotoStatus) || 'all'
  );
  const [isModerator, setIsModerator] = useState(false);

  // Ref to store the fetchPhotos function
  const fetchPhotosRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const eventResponse = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        const eventData = await eventResponse.json();
        if (eventResponse.ok) {
          setEvent(eventData.data);
        }

        // Build query params
        const queryParams = new URLSearchParams();
        if (activeStatus !== 'all') {
          queryParams.append('status', activeStatus);
        }

        const response = await fetch(
          `/api/events/${eventId}/photos?${queryParams.toString()}`,
          {
            credentials: 'include',
            cache: 'no-store', // Prevent caching to ensure fresh data on tab switch
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load photos');
        }

        console.log('[PHOTOS_PAGE] Fetched photos:', {
          activeStatus,
          queryParams: queryParams.toString(),
          receivedCount: data.data?.length || 0,
          statuses: data.data?.map((p: IPhoto) => p.status),
        });

        setPhotos(data.data);

        // For now, assume all users accessing this route are moderators
        // The API should handle authorization properly
        setIsModerator(true);
        setError(null);
      } catch (err) {
        console.error('[PHOTOS_PAGE] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      } finally {
        setIsLoading(false);
      }
    };

    // Store the function in ref for use in handlePhotoUpdate
    fetchPhotosRef.current = fetchPhotos;
    fetchPhotos();
  }, [eventId, activeStatus]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/moderation-logs?limit=20`, {
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
          setModerationLogs(data.data || []);
        }
      } catch (err) {
        console.error('[PHOTOS_PAGE] Failed to fetch moderation logs:', err);
      }
    };

    fetchLogs();
  }, [eventId]);

  // Handle photo status update (approve/reject)
  const handlePhotoUpdate = useCallback(async (photoId: string, newStatus: 'approved' | 'rejected') => {
    // Remove the photo from current view (optimistic update)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));

    // Immediately refetch to ensure we have the latest data
    fetchPhotosRef.current?.();
  }, []);

  const handlePhotoDelete = useCallback(async (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    fetchPhotosRef.current?.();
  }, []);

  const handleStatusChange = (status: PhotoStatus) => {
    setActiveStatus(status);
    // Update URL without reloading
    const url = new URL(window.location.href);
    if (status === 'all') {
      url.searchParams.delete('status');
    } else {
      url.searchParams.set('status', status);
    }
    router.push(url.pathname + url.search, { scroll: false });
  };

  const handleReaction = async (photoId: string, emoji: string) => {
    // Reaction is handled by PhotoGallery component
    // This is just a placeholder callback
  };

  const statusTabs = [
    { id: 'all' as const, label: 'All', icon: null },
    { id: 'pending' as const, label: 'Pending', icon: Clock },
    { id: 'approved' as const, label: 'Approved', icon: CheckCircle },
    { id: 'rejected' as const, label: 'Rejected', icon: XCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
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
                Photo Moderation
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Review and manage photo submissions
              </p>
            </div>
            {isModerator && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-900/20">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Moderator Mode
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-8 overflow-x-auto">
            {statusTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleStatusChange(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                    activeStatus === tab.id
                      ? 'border-violet-500 text-violet-600 dark:border-violet-400 dark:text-violet-400'
                      : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {tab.label}
                  {tab.id !== 'all' && (
                    <span
                      className={clsx(
                        'ml-1 rounded-full px-2 py-0.5 text-xs',
                        activeStatus === tab.id
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      {photos.filter(p => p.status === tab.id).length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
            <Shield className="mx-auto h-12 w-12 text-red-500" />
            <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
          </div>
        ) : (
          <PhotoGallery
            isModerator={isModerator}
            photos={photos}
            onReaction={handleReaction}
            onPhotoUpdate={handlePhotoUpdate}
            allowDownload
            onPhotoDelete={handlePhotoDelete}
          />
        )}

        {/* Empty state for specific status */}
        {!isLoading && !error && photos.length === 0 && activeStatus !== 'all' && (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-500">No {activeStatus} photos</p>
            <p className="text-sm text-gray-400">
              Try selecting a different status filter
            </p>
          </div>
        )}

        {/* Moderation Log */}
        {moderationLogs.length > 0 && (
          <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Moderation Activity
            </h2>
            <div className="space-y-3">
              {moderationLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                      {log.imageUrl ? (
                        <img
                          src={log.imageUrl}
                          alt="Moderated"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {log.action.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {log.moderatorName || log.moderatorEmail}
                        {log.photoStatus ? ` • ${log.photoStatus}` : ''}
                      </div>
                      {log.reason && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          Reason: {log.reason}
                        </div>
                      )}
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
    </div>
  );
}
