// ============================================
// Galeria - Event Detail Page
// ============================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Share2,
  Settings,
  Upload,
  Loader2,
  Image as ImageIcon,
  Heart,
  Camera,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { IEvent, IPhoto } from '@/lib/types';
import { usePhotoGallery } from '@/lib/realtime/client';
import { getClientFingerprint } from '@/lib/fingerprint';

interface ReactionButtonsProps {
  photo: IPhoto;
  onReaction: (photoId: string, type: 'heart') => void;
}

function ReactionButtons({ photo, onReaction }: ReactionButtonsProps) {
  const heartCount = photo.reactions.heart || 0;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onReaction(photo.id, 'heart')}
        className={clsx(
          'flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          heartCount > 0
            ? 'bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-400'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
        )}
      >
        <span className="text-red-500">❤️</span>
        <span>{heartCount}</span>
      </button>
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [photos, setPhotos] = useState<IPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<IPhoto | null>(null);
  const { channel, broadcastNewPhoto } = usePhotoGallery(eventId);
  const fingerprint = useMemo(() => getClientFingerprint(), []);

  // Quick camera upload state
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // const [uploadSuccess, setUploadSuccess] = useState(false); // Replaced by toast
  // const [uploadError, setUploadError] = useState<string | null>(null); // Replaced by toast

  const fetchEvent = async () => {
    try {
      const [eventRes, photosRes] = await Promise.all([
        fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        }),
        fetch(`/api/events/${eventId}/photos`, {
          credentials: 'include',
        }),
      ]);

      const eventData = await eventRes.json();
      const photosData = await photosRes.json();

      if (!eventRes.ok) {
        throw new Error(eventData.error || 'Failed to load event');
      }

      setEvent(eventData.data);
      setPhotos(photosData.data || []);
      setError(null);
    } catch (err) {
      console.error('[EVENT_DETAIL] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (!channel) return;

    // The channel subscription is already managed by usePhotoGallery hook
    // We just need to handle photo updates from the channel
    const handleNewPhoto = (payload: { payload: IPhoto }) => {
      const photo = payload.payload;
      if (event?.settings?.features?.moderation_required && photo.status !== 'approved') {
        return;
      }
      setPhotos((prev) => {
        if (prev.some((p) => p.id === photo.id)) {
          return prev;
        }
        return [photo, ...prev];
      });
    };

    const handlePhotoUpdated = (payload: { payload: { photo_id: string; status: string } }) => {
      const data = payload.payload;
      setPhotos((prev) => {
        const updated = prev.map((photo) =>
          photo.id === data.photo_id
            ? { ...photo, status: data.status as IPhoto['status'] }
            : photo
        );

        if (event?.settings?.features?.moderation_required && data.status !== 'approved') {
          return updated.filter((photo) => photo.status === 'approved');
        }

        return updated;
      });
    };

    channel.on('broadcast', { event: 'new_photo' }, handleNewPhoto);
    channel.on('broadcast', { event: 'photo_updated' }, handlePhotoUpdated);

    return () => {
      // Cleanup is handled by the usePhotoGallery hook
    };
  }, [channel, eventId, fingerprint, event]);

  const handleReaction = async (photoId: string, type: 'heart') => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (fingerprint) {
        headers['x-fingerprint'] = fingerprint;
      }

      const response = await fetch(`/api/photos/${photoId}/reactions`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        const data = await response.json();
        setPhotos(prev =>
          prev.map(p => {
            if (p.id === photoId) {
              return {
                ...p,
                reactions: {
                  ...p.reactions,
                  [type]: data.data?.count ?? (p.reactions[type] || 0),
                },
              };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.error('[EVENT_DETAIL] Reaction error:', err);
    }
  };

  // Quick camera upload handler
  const handleCameraCapture = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    // setUploadError(null);
    // setUploadSuccess(false);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const headers: Record<string, string> = {};
      if (fingerprint) {
        headers['x-fingerprint'] = fingerprint;
      }

      const response = await fetch(`/api/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const uploaded = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
        // setUploadSuccess(true);
        toast.success('Photo uploaded successfully!');

        // Broadcast to channel for real-time updates
        uploaded.forEach((photo: IPhoto) => {
          broadcastNewPhoto(photo);
        });

        // Refresh photos
        fetchEvent();

        // Close modal after showing success
        setTimeout(() => {
          setShowCameraModal(false);
          // setUploadSuccess(false);
        }, 500);
      } else {
        // setUploadError(result.error || 'Upload failed');
        toast.error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('[EVENT_DETAIL] Upload error:', err);
      // setUploadError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

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
            href="/events"
            className="mt-4 inline-block text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.event_date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="relative h-64 overflow-hidden bg-gradient-to-br from-violet-600 to-pink-600 sm:h-80">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">{event.name}</h1>
            {event.custom_hashtag && (
              <p className="mt-2 text-xl opacity-90">#{event.custom_hashtag}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/events"
          className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Link>

        {/* Event Info */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Event Details</h2>
              {event.description && (
                <p className="mt-2 text-gray-600 dark:text-gray-400">{event.description}</p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span>{formattedDate}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    <span>{event.location}</span>
                  </div>
                )}
                {event.expected_guests && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{event.expected_guests} expected guests</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Link
                href={`/events/${event.id}/upload`}
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-violet-700 hover:to-pink-700"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Photos
              </Link>
              <Link
                href={`/organizer/events/${event.id}/admin`}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Link>
            </div>
          </div>
        </div>

        {/* Photos Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Photos ({photos.length})
            </h2>
          </div>

          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ImageIcon className="mb-4 h-16 w-16 text-gray-400" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No photos yet</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Be the first to share a moment!
              </p>
              <Link
                href={`/events/${event.id}/upload`}
                className="mt-4 inline-flex items-center rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-violet-700 hover:to-pink-700"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Photos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {photos.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                >
                  <Image
                    src={photo.images.medium_url}
                    alt={photo.caption || 'Event photo'}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  />
                  {photo.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="truncate text-xs text-white">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-h-full max-w-full" onClick={e => e.stopPropagation()}>
            <Image
              src={selectedPhoto.images.full_url}
              alt={selectedPhoto.caption || 'Event photo'}
              width={selectedPhoto.images.width}
              height={selectedPhoto.images.height}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -right-12 top-0 text-white hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 text-white">
            {selectedPhoto.caption && (
              <p className="text-lg">{selectedPhoto.caption}</p>
            )}
            {!selectedPhoto.is_anonymous && selectedPhoto.contributor_name && (
              <p className="text-sm opacity-75">by {selectedPhoto.contributor_name}</p>
            )}
            <ReactionButtons photo={selectedPhoto} onReaction={handleReaction} />
          </div>
        </div>
      )}

      {/* Floating Camera Button */}
      {event?.settings?.features?.photo_upload_enabled !== false && (
        <button
          onClick={() => setShowCameraModal(true)}
          className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-2xl hover:from-violet-700 hover:to-pink-700 transition-all hover:scale-110 active:scale-95"
          aria-label="Quick photo upload"
        >
          <Camera className="h-8 w-8" />
        </button>
      )}

      {/* Quick Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Quick Photo Upload
              </h3>
              <button
                onClick={() => {
                  setShowCameraModal(false);
                  // setUploadSuccess(false);
                  // setUploadError(null);
                }}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message - Removed custom alerts */}
            {/*
            {uploadSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                <Check className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">Photo uploaded successfully!</p>
              </div>
            )}

            {uploadError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{uploadError}</p>
              </div>
            )}
            */}

            {/* Upload Options */}
            {/* {!uploadSuccess && ( */}
            <div className="space-y-3">
              {/* Camera Button */}
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-violet-50 to-pink-50 p-6 transition-all hover:border-violet-400 hover:from-violet-100 hover:to-pink-100 dark:from-violet-900/20 dark:to-pink-900/20 dark:hover:from-violet-900/30 dark:hover:to-pink-900/30">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleCameraCapture(e.target.files)}
                  className="hidden"
                  disabled={isUploading}
                />
                <Camera className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {isUploading ? 'Uploading...' : 'Take Photo'}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Open camera to capture
                </span>
              </label>

              {/* Gallery Button */}
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-all hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 dark:hover:bg-gray-700">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleCameraCapture(e.target.files)}
                  className="hidden"
                  disabled={isUploading}
                />
                <ImageIcon className="h-10 w-10 text-gray-600 dark:text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {isUploading ? 'Uploading...' : 'Choose from Gallery'}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Browse photos on your device
                </span>
              </label>
            </div>
            {/* )} */}

            {/* Helper Text */}
            <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
              Up to 5 photos, max 10MB each (JPEG, PNG, WebP)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
