// ============================================
// MOMENTIQUE - Real-Time Photo Gallery Component
// ============================================
// Displays photos with live updates via WebSocket

'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import { Check, Heart, X } from 'lucide-react';
import { toast } from 'sonner';
import type { IPhoto } from '@/lib/types';

// ============================================
// TYPES
// ============================================

interface PhotoGalleryProps {
  isModerator?: boolean;
  photos?: IPhoto[];
  onReaction?: (photoId: string, emoji: string) => void;
  onPhotoUpdate?: (photoId: string, status: 'approved' | 'rejected') => void;
  allowDownload?: boolean;
  onPhotoDelete?: (photoId: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export function PhotoGallery({
  isModerator = false,
  photos: initialPhotos = [],
  onReaction,
  onPhotoUpdate,
  allowDownload = false,
  onPhotoDelete,
}: PhotoGalleryProps) {
  // State
  const [photos, setPhotos] = useState<IPhoto[]>(initialPhotos);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Sync local state when props change (e.g., when switching status tabs)
  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  // ============================================
  // REACTION HANDLERS
  // ============================================

  const handleReaction = useCallback(
    async (photoId: string) => {
      try {
        const response = await fetch(`/api/photos/${photoId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type: 'heart' }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update local state
          setPhotos((prev) =>
            prev.map((photo) =>
              photo.id === photoId
                ? {
                    ...photo,
                    reactions: {
                      ...photo.reactions,
                      heart: data.data?.count ?? (photo.reactions.heart || 0) + 1,
                    },
                  }
                : photo
            )
          );
          // Call callback
          onReaction?.(photoId, 'heart');
        }
      } catch (error) {
        console.error('[Gallery] Error adding reaction:', error);
      }
    },
    [onReaction]
  );

  // ============================================
  // MODERATION ACTIONS (if moderator)
  // ============================================

  const handleApprove = useCallback(
    async (photoId: string) => {
      if (!isModerator) return;

      try {
        const toastId = toast.loading('Approving photo...');
        const response = await fetch(`/api/photos/${photoId}/approve`, {
          method: 'PATCH',
        });

        if (response.ok) {
          // Update local state
          setPhotos((prev) =>
            prev.map((photo) =>
              photo.id === photoId ? { ...photo, status: 'approved' as IPhoto['status'] } : photo
            )
          );
          // Notify parent to update its state and refetch if needed
          onPhotoUpdate?.(photoId, 'approved');
          toast.success('Photo approved', { id: toastId });
        } else {
          const error = await response.json().catch(() => ({}));
          toast.error(error.error || 'Failed to approve photo', { id: toastId });
        }
      } catch (error) {
        console.error('[Gallery] Error approving photo:', error);
        toast.error('Failed to approve photo');
      }
    },
    [isModerator, onPhotoUpdate]
  );

  const handleReject = useCallback(
    async (photoId: string) => {
      if (!isModerator) return;

      try {
        const toastId = toast.loading('Rejecting photo...');
        const response = await fetch(`/api/photos/${photoId}/reject`, {
          method: 'PATCH',
        });

        if (response.ok) {
          // Update local state
          setPhotos((prev) =>
            prev.map((photo) =>
              photo.id === photoId ? { ...photo, status: 'rejected' as IPhoto['status'] } : photo
            )
          );
          // Notify parent to update its state and refetch if needed
          onPhotoUpdate?.(photoId, 'rejected');
          toast.success('Photo rejected', { id: toastId });
        } else {
          const error = await response.json().catch(() => ({}));
          toast.error(error.error || 'Failed to reject photo', { id: toastId });
        }
      } catch (error) {
        console.error('[Gallery] Error rejecting photo:', error);
        toast.error('Failed to reject photo');
      }
    },
    [isModerator, onPhotoUpdate]
  );

  // ============================================
  // LIGHTBOX HANDLERS
  // ============================================

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // ============================================
  // DOWNLOAD HANDLER
  // ============================================

  const handleDownload = useCallback(async (photo: IPhoto) => {
    try {
      const src = photo.images.full_url || photo.images.original_url;
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error('Failed to download image');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photo-${photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('[Gallery] Download failed:', error);
    }
  }, []);

  const handleDelete = useCallback(async (photo: IPhoto) => {
    const confirmed = window.confirm('Delete this photo? This cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete photo');
      }

      onPhotoDelete?.(photo.id);
    } catch (error) {
      console.error('[Gallery] Delete failed:', error);
    }
  }, [onPhotoDelete]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="w-full">
      {/* Gallery Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo, index) => {
          const photoReactions = photo.reactions;

          return (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-lg bg-white shadow-md hover:shadow-xl transition-shadow duration-200"
              onClick={() => openLightbox(index)}
            >
              {/* Image */}
              <div className="relative aspect-square">
                <Image
                  src={photo.images.medium_url || photo.images.full_url}
                  alt={photo.caption || 'Event photo'}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1920px) 50vw, (max-width: 3840px) 33vw"
                  className="object-cover w-full h-full cursor-pointer"
                  loading="lazy"
                />
              </div>

              {/* Download button */}
              {allowDownload && !isModerator && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(photo);
                  }}
                  className="absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  title="Download photo"
                >
                  <span className="sr-only">Download photo</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}

              {/* Overlay on hover */}
              <div
                className={
                  isModerator
                    ? "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    : "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                }
              >
                <div className="p-4 text-white">
                  {!isModerator && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReaction(photo.id);
                      }}
                      className="flex items-center gap-2 cursor-pointer hover:scale-110 transition-transform"
                    >
                      <Heart className="h-4 w-4 text-pink-300" />
                      <span className="font-semibold">{photoReactions.heart || 0}</span>
                    </button>
                  )}

                  {photo.caption && (
                    <p className="mt-2 text-sm line-clamp-2">{photo.caption}</p>
                  )}

                  {!photo.is_anonymous && photo.contributor_name && (
                    <p className="text-xs opacity-75">- {photo.contributor_name}</p>
                  )}

                  {isModerator && photo.status === 'pending' && (
                    <div className="absolute bottom-2 left-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(photo.id);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white shadow-sm hover:bg-green-700"
                        title="Approve photo"
                      >
                        <span className="sr-only">Approve photo</span>
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(photo.id);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700"
                        title="Reject photo"
                      >
                        <span className="sr-only">Reject photo</span>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  
                </div>
              </div>

              {isModerator && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(photo);
                  }}
                  className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700"
                  title="Delete photo"
                >
                  <span className="sr-only">Delete photo</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              )}

              {/* Status badge */}
              {photo.status === 'pending' && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                  Pending
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No photos message */}
      {photos.length === 0 && (
        <div className="text-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="M7 8l5-5 5 5" />
            <rect x="4" y="15" width="16" height="6" rx="2" />
          </svg>
          <p className="text-gray-500">No photos yet</p>
          <p className="text-sm text-gray-400">Be the first to share a moment!</p>
        </div>
      )}

      {/* Lightbox */}
      {photos.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={closeLightbox}
          index={lightboxIndex}
          slides={photos.map((photo) => ({
            src: photo.images.full_url,
            alt: photo.caption || 'Event photo',
            caption: photo.caption,
          }))}
        />
      )}
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default PhotoGallery;
