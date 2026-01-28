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
  const [isEventLoading, setIsEventLoading] = useState(true);
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
  const photosCacheRef = useRef<Record<PhotoStatus, IPhoto[]>>({
    all: [],
    pending: [],
    approved: [],
    rejected: [],
  });
  const photosLoadedRef = useRef<Record<PhotoStatus, boolean>>({
    all: false,
    pending: false,
    approved: false,
    rejected: false,
  });

  // Ref to store the fetchPhotos function
  const fetchPhotosRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    photosCacheRef.current = { all: [], pending: [], approved: [], rejected: [] };
    photosLoadedRef.current = { all: false, pending: false, approved: false, rejected: false };
    setPhotos([]);
    setIsLoading(true);
    setIsEventLoading(true);
  }, [eventId]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventResponse = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        const eventData = await eventResponse.json();
        if (eventResponse.ok) {
          setEvent(eventData.data);
        }
      } catch (err) {
        console.error('[PHOTOS_PAGE] Event error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setIsEventLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    const fetchPhotos = async (status: PhotoStatus) => {
      try {
        const queryParams = new URLSearchParams();
        if (status !== 'all') {
          queryParams.append('status', status);
        }

        const response = await fetch(
          `/api/events/${eventId}/photos?${queryParams.toString()}`,
          {
            credentials: 'include',
            cache: 'no-store',
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load photos');
        }

        photosCacheRef.current[status] = data.data || [];
        photosLoadedRef.current[status] = true;
        setPhotos(data.data || []);

        // For now, assume all users accessing this route are moderators
        setIsModerator(true);
        setError(null);
      } catch (err) {
        console.error('[PHOTOS_PAGE] Photos error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      } finally {
        setIsLoading(false);
      }
    };

    // Store the function in ref for use in handlePhotoUpdate
    fetchPhotosRef.current = async () => {
      await fetchPhotos(activeStatus);
    };

    // Use cached results if available, otherwise fetch
    const cached = photosCacheRef.current[activeStatus];
    if (photosLoadedRef.current[activeStatus]) {
      setPhotos(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      fetchPhotos(activeStatus);
    }
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

  const getStatusCount = (status: PhotoStatus) => {
    const cached = photosCacheRef.current[status] || [];
    return cached.length;
  };

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
                      {getStatusCount(tab.id)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        {isLoading || isEventLoading ? (
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
      </div>
    </div>
  );
}
