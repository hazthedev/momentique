// ============================================
// Gatherly - Guest Event Page (Shareable Link)
// ============================================
// Public event page for guests - no authentication required

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Calendar,
  MapPin,
  Users,
  Share2,
  Upload,
  Loader2,
  ImageIcon,
  X,
  Trophy,
  Camera,
  Check,
  AlertCircle,
  Heart,
  Download,
  User,
} from 'lucide-react';
import clsx from 'clsx';
import type { IEvent, IPhoto } from '@/lib/types';
import { getClientFingerprint } from '@/lib/fingerprint';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { useLuckyDraw } from '@/lib/realtime/client';

// ============================================
// TYPES
// ============================================

interface SelectedFile {
  file: File;
  preview: string;
  name: string;
}

const GUEST_MAX_DIMENSION = 4000;

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

async function resizeImageIfNeeded(file: File, maxDimension: number): Promise<{ file: File; resized: boolean }> {
  try {
    const img = await loadImageElement(file);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return { file, resized: false };

    const scale = Math.min(maxDimension / width, maxDimension / height, 1);
    if (scale >= 1) return { file, resized: false };

    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, resized: false };

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const outputType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, 0.9)
    );
    if (!blob) return { file, resized: false };

    return {
      file: new File([blob], file.name, { type: blob.type || outputType, lastModified: file.lastModified }),
      resized: true,
    };
  } catch {
    return { file, resized: false };
  }
}

// ============================================
// GUEST NAME MODAL COMPONENT
// ============================================

function GuestNameModal({
  isOpen,
  onSubmit,
  eventName,
  initialName,
  initialAnonymous,
}: {
  isOpen: boolean;
  onSubmit: (name: string, isAnonymous: boolean) => void;
  eventName: string;
  initialName?: string;
  initialAnonymous?: boolean;
}) {
  const [name, setName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName || '');
    setIsAnonymous(!!initialAnonymous);
    setError('');
  }, [isOpen, initialName, initialAnonymous]);

  const handleSubmit = () => {
    if (!isAnonymous && !name.trim()) {
      setError('Please enter your name or choose anonymous');
      return;
    }
    onSubmit(isAnonymous ? '' : name.trim(), isAnonymous);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 animate-in fade-in zoom-in duration-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
            <User className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Welcome to {eventName}!
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please enter your name to get started
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="John Doe"
              disabled={isAnonymous}
              className={clsx(
                "w-full rounded-lg border px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 dark:bg-gray-700 dark:text-gray-100",
                isAnonymous
                  ? "border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-600"
                  : "border-gray-300 bg-white dark:border-gray-600"
              )}
              maxLength={100}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => {
                setIsAnonymous(e.target.checked);
                setError('');
              }}
              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Stay Anonymous
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your name won't be shown on photos
              </p>
            </div>
          </label>

          {isAnonymous && (
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                ⚠️ Anonymous users cannot participate in the lucky draw
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 py-3 text-sm font-semibold text-white hover:from-violet-700 hover:to-pink-700 transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function GuestEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<IEvent | null>(null);
  const [photos, setPhotos] = useState<IPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [optimizedCount, setOptimizedCount] = useState(0);
  const [joinLuckyDraw, setJoinLuckyDraw] = useState(true);
  const [hasJoinedDraw, setHasJoinedDraw] = useState(false);
  const fingerprint = useMemo(() => getClientFingerprint(), []);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);
  const { winner, isDrawing } = useLuckyDraw(resolvedEventId || '');
  const [showDrawOverlay, setShowDrawOverlay] = useState(false);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);

  // Guest name state (persisted)
  const [guestName, setGuestName] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Selected files for upload (preview before submit)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [caption, setCaption] = useState('');

  // Track user's love reactions (max 10 per photo per user)
  const [userLoves, setUserLoves] = useState<Record<string, number>>({});

  // Track which photos are currently showing the heart animation
  const [animatingPhotos, setAnimatingPhotos] = useState<Set<string>>(new Set());

  // Load guest name from localStorage on mount
  useEffect(() => {
    if (!resolvedEventId) return;
    const storageKey = `guest_name_${resolvedEventId}`;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setGuestName(parsed.name || '');
        setIsAnonymous(parsed.isAnonymous || false);
      } catch {
        // Show modal if no valid data
        setShowGuestModal(true);
      }
    } else {
      setShowGuestModal(true);
    }
  }, [resolvedEventId]);

  // Handle guest modal submit
  const handleGuestModalSubmit = (name: string, anonymous: boolean) => {
    setGuestName(name);
    setIsAnonymous(anonymous);
    setShowGuestModal(false);

    // If anonymous, can't join lucky draw
    if (anonymous) {
      setJoinLuckyDraw(false);
    } else if (!hasJoinedDraw) {
      setJoinLuckyDraw(true);
    }

    // Save to localStorage
    if (resolvedEventId) {
      const storageKey = `guest_name_${resolvedEventId}`;
      localStorage.setItem(storageKey, JSON.stringify({ name, isAnonymous: anonymous }));
    }
  };

  // Load user's love reactions from localStorage
  useEffect(() => {
    if (!fingerprint || !resolvedEventId) return;
    const storageKey = `love_reactions_${resolvedEventId}_${fingerprint}`;
    const savedLoves = localStorage.getItem(storageKey);
    if (savedLoves) {
      try {
        setUserLoves(JSON.parse(savedLoves));
      } catch {
        setUserLoves({});
      }
    }
  }, [fingerprint, resolvedEventId]);

  // Save love reactions to localStorage
  const saveUserLoves = (loves: Record<string, number>) => {
    if (!fingerprint || !resolvedEventId) return;
    const storageKey = `love_reactions_${resolvedEventId}_${fingerprint}`;
    localStorage.setItem(storageKey, JSON.stringify(loves));
    setUserLoves(loves);
  };

  useEffect(() => {
    if (isDrawing) {
      setShowDrawOverlay(true);
      setShowWinnerOverlay(false);
    }
  }, [isDrawing]);

  useEffect(() => {
    if (!winner) return;
    setShowDrawOverlay(false);
    setShowWinnerOverlay(true);
    const timeout = setTimeout(() => setShowWinnerOverlay(false), 12000);
    return () => clearTimeout(timeout);
  }, [winner]);

  // Handle love reaction on double-click with heart burst animation
  const handleLoveReaction = async (photoId: string) => {
    const currentLoves = userLoves[photoId] || 0;
    const maxLovesPerUser = 10;

    // Check if user has reached max loves for this photo
    if (currentLoves >= maxLovesPerUser) {
      return; // Silently ignore if max reached
    }

    // Trigger heart burst animation
    setAnimatingPhotos(prev => new Set(prev).add(photoId));
    setTimeout(() => {
      setAnimatingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
    }, 800); // Animation duration

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (fingerprint) {
        headers['x-fingerprint'] = fingerprint;
      }
      if (event?.tenant_id) {
        headers['x-tenant-id'] = event.tenant_id;
      }

      // Use increment mode to always add (up to max), never toggle
      const response = await fetch(`/api/photos/${photoId}/reactions?mode=increment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'heart' }),
      });

      if (response.ok) {
        const data = await response.json();

        // Only update if reaction was actually added
        if (data.data?.added) {
          // Update user's love count from server response
          const newUserCount = data.data.userCount ?? (currentLoves + 1);
          saveUserLoves({ ...userLoves, [photoId]: newUserCount });

          // Update photo in state
          setPhotos(prev =>
            prev.map(p => {
              if (p.id === photoId) {
                return {
                  ...p,
                  reactions: {
                    ...p.reactions,
                    heart: data.data?.count ?? (p.reactions.heart || 0) + 1,
                  },
                };
              }
              return p;
            })
          );
        }
      }
    } catch (err) {
      console.error('[GUEST_EVENT] Love reaction error:', err);
    }
  };

  // Download photo
  const handleDownloadPhoto = async (photo: IPhoto) => {
    try {
      const response = await fetch(`/api/photos/${photo.id}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `photo-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[GUEST_EVENT] Download error:', err);
    }
  };

  const handleDownloadAll = () => {
    const targetEventId = resolvedEventId || eventId;
    if (!targetEventId) return;
    window.location.href = `/api/events/${targetEventId}/download`;
  };

  // Check if input looks like a UUID (8-4-4-4-12 format)
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Fetch event and photos
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        let actualEventId = eventId;

        // If not a UUID, try to resolve as short code
        if (!isUUID(eventId)) {
          setIsResolving(true);
          const resolveResponse = await fetch(`/api/resolve?code=${encodeURIComponent(eventId)}`);
          const resolveData = await resolveResponse.json();

          if (resolveResponse.ok && resolveData.data) {
            actualEventId = resolveData.data.id;
            setResolvedEventId(actualEventId);
          } else {
            throw new Error(resolveData.error || 'Invalid event link');
          }
          setIsResolving(false);
        } else {
          setResolvedEventId(eventId);
        }

        // Fetch event details
        const eventResponse = await fetch(`/api/events/${actualEventId}`);
        const eventData = await eventResponse.json();

        if (!eventResponse.ok) {
          throw new Error(eventData.error || 'Event not found');
        }

        setEvent(eventData.data);

        // Fetch photos (only approved ones for guests)
        const photosResponse = await fetch(`/api/events/${actualEventId}/photos?status=approved`);
        const photosData = await photosResponse.json();

        if (photosResponse.ok) {
          setPhotos(photosData.data || []);
        }

        setError(null);
      } catch (err) {
        console.error('[GUEST_EVENT] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  // Share functionality (always use short link)
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !event) {
      return '';
    }
    const code = event.short_code || event.id;
    return `${window.location.origin}/e/${code}`;
  }, [event]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.name || 'Event',
          text: event?.description || `Join ${event?.name} on Gatherly!`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share not supported
        console.log('Share cancelled');
      }
    } else {
      setShowShareModal(true);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setShowShareModal(false);
  };

  // Handle file selection (preview, don't upload yet)
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < Math.min(files.length, 5 - selectedFiles.length); i++) {
      const file = files[i];
      newFiles.push({
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      });
    }
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  // Remove selected file
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Handle actual upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one photo');
      return;
    }
    if (!guestName.trim() && !isAnonymous) {
      setUploadError('Please enter your name first');
      return;
    }
    if ((isAnonymous || !guestName.trim()) && !recaptchaToken) {
      setUploadError('Please complete the CAPTCHA');
      return;
    }

    setUploadError(null);

    try {
      setIsOptimizing(true);
      let resizedCount = 0;
      const processedFiles: File[] = [];

      for (const selectedFile of selectedFiles) {
        const result = await resizeImageIfNeeded(selectedFile.file, GUEST_MAX_DIMENSION);
        if (result.resized) resizedCount += 1;
        processedFiles.push(result.file);
      }

      setOptimizedCount(resizedCount);
      setIsOptimizing(false);
      setIsUploading(true);

      const formData = new FormData();
      for (const file of processedFiles) {
        formData.append('files', file);
      }
      formData.append('contributor_name', guestName.trim());
      formData.append('is_anonymous', isAnonymous ? 'true' : 'false');
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }
      if (joinLuckyDraw && !isAnonymous) {
        formData.append('join_lucky_draw', 'true');
      }
      if (recaptchaToken) {
        formData.append('recaptchaToken', recaptchaToken);
      }

      const response = await fetch(`/api/events/${resolvedEventId}/photos`, {
        method: 'POST',
        headers: fingerprint ? {
          'x-fingerprint': fingerprint,
        } : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload photo');
      }

      // Add the new photo(s) to the gallery
      const uploadedPhotos = Array.isArray(data.data) ? data.data : [data.data];
      setPhotos((prev) => [...uploadedPhotos, ...prev]);

      // If successfully joined the draw, mark as joined
      if (joinLuckyDraw && !isAnonymous) {
        setHasJoinedDraw(true);
      }

      // Show success and reset
      setUploadSuccess(true);

      // Clean up previews
      selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));

      setTimeout(() => {
        setUploadSuccess(false);
        setShowUploadModal(false);
        setSelectedFiles([]);
        setCaption('');
        setOptimizedCount(0);
        setRecaptchaToken(null);
        setRecaptchaError(null);
      }, 1500);
    } catch (err) {
      console.error('[GUEST_EVENT] Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setIsOptimizing(false);
      setIsUploading(false);
    }
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        {isResolving && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Resolving event link...</p>
        )}
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <X className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {error || 'Event not found'}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            The event may have been removed or the link is incorrect.
          </p>
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

  const canDownload = event.settings?.features?.guest_download_enabled !== false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Guest Name Modal */}
      <GuestNameModal
        isOpen={showGuestModal}
        onSubmit={handleGuestModalSubmit}
        eventName={event.name}
        initialName={guestName}
        initialAnonymous={isAnonymous}
      />

      {/* Lucky Draw Overlays */}
      {showDrawOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Lucky Draw
              </h3>
              <button
                onClick={() => setShowDrawOverlay(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                The lucky draw is starting...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Stay tuned for the winner announcement.
              </p>
            </div>
          </div>
        </div>
      )}

      {showWinnerOverlay && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Winner Announced
              </h3>
              <button
                onClick={() => setShowWinnerOverlay(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              {winner.selfie_url ? (
                <img
                  src={winner.selfie_url}
                  alt="Winner"
                  className="h-24 w-24 rounded-full object-cover border-4 border-yellow-400 shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                  <Trophy className="h-10 w-10" />
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Prize Tier {winner.prize_tier}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {winner.participant_name || 'Anonymous'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {event.name}
              </h1>
              {event.custom_hashtag && (
                <p className="text-sm text-violet-600 dark:text-violet-400">
                  #{event.custom_hashtag}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(guestName || isAnonymous) && (
                <span className="hidden sm:block text-sm text-gray-600 dark:text-gray-400">
                  Hi, {isAnonymous ? 'Anonymous' : guestName}!
                </span>
              )}
              {canDownload && (
                <button
                  onClick={handleDownloadAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Download className="h-4 w-4" />
                  Download all
                </button>
              )}
              <button
                onClick={() => setShowGuestModal(true)}
                className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {isAnonymous || !guestName ? 'Add name' : 'Edit name'}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-violet-700 hover:to-pink-700"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Event Details Card */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-1 h-5 w-5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Date</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formattedDate}</p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Location</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{event.location}</p>
                </div>
              </div>
            )}

            {event.expected_guests && (
              <div className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Guests</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{event.expected_guests}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <ImageIcon className="mt-1 h-5 w-5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Photos</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{photos.length}</p>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">{event.description}</p>
            </div>
          )}
        </div>

        {/* Upload CTA */}
        <div className="mb-8">
          <button
            onClick={() => {
              setShowUploadModal(true);
              setRecaptchaToken(null);
              setRecaptchaError(null);
            }}
            className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center hover:border-violet-400 hover:bg-violet-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 dark:hover:bg-violet-900/20 transition-colors"
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-violet-600 dark:text-violet-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Share Your Photos
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Upload your favorite moments from this event
            </p>
          </button>
        </div>

        {/* Photo Gallery */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Event Photos
          </h2>
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-600 dark:bg-gray-800">
              <ImageIcon className="mx-auto mb-4 h-16 w-16 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">No photos yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Be the first to share a moment!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {photos.map((photo) => {
                const userLoveCount = userLoves[photo.id] || 0;
                const totalHeartCount = photo.reactions?.heart || 0;

                return (
                  <div
                    key={photo.id}
                    onDoubleClick={() => handleLoveReaction(photo.id)}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 cursor-pointer"
                  >
                    <Image
                      src={photo.images.medium_url || photo.images.full_url}
                      alt={photo.caption || 'Event photo'}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                      className="object-cover"
                    />

                    {/* Download button */}
                    {canDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPhoto(photo);
                        }}
                        className="absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                        title="Download photo"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}

                    {/* Love Icon at Top Right (when user has loved) */}
                    {userLoveCount > 0 && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-pink-500 px-2 py-1 shadow-lg">
                        <Heart className="h-4 w-4 fill-white text-white" />
                        <span className="text-xs font-bold text-white">{userLoveCount}</span>
                      </div>
                    )}

                    {/* Total Heart Count Badge */}
                    {totalHeartCount > 0 && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 backdrop-blur-sm">
                        <Heart className={clsx(
                          "h-3.5 w-3.5",
                          userLoveCount > 0 ? "fill-pink-500 text-pink-500" : "fill-white text-white"
                        )} />
                        <span className="text-xs font-medium text-white">{totalHeartCount}</span>
                      </div>
                    )}

                    {/* Overlay on hover */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                        {photo.caption && (
                          <p className="text-xs line-clamp-2">{photo.caption}</p>
                        )}
                        {!photo.is_anonymous && photo.contributor_name && (
                          <p className="text-xs opacity-75">- {photo.contributor_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Heart Burst Animation (on double-click) */}
                    {animatingPhotos.has(photo.id) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <Heart
                          className="h-20 w-20 fill-pink-500 text-pink-500 drop-shadow-lg animate-[heartBurst_0.8s_ease-out_forwards]"
                        />
                      </div>
                    )}

                    {/* Double-click hint overlay (only on hover, hidden during animation) */}
                    {!animatingPhotos.has(photo.id) && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <Heart className="h-12 w-12 text-white opacity-80" />
                        {userLoveCount >= 10 && (
                          <span className="absolute bottom-12 text-xs text-white bg-black/50 px-2 py-1 rounded">Max reached</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Share Event
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Share this link with guests to let them view and upload photos:
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Upload Photo
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setUploadError(null);
                  setUploadSuccess(false);
                  setCaption('');
                  setOptimizedCount(0);
                  setRecaptchaToken(null);
                  setRecaptchaError(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={isUploading || isOptimizing}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success Message */}
            {uploadSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                <Check className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">
                  Photo uploaded successfully!
                  {optimizedCount > 0 && (
                    <span className="ml-2 text-xs text-green-700 dark:text-green-300">
                      Optimized {optimizedCount} photo{optimizedCount > 1 ? 's' : ''} for upload.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {uploadError}
              </div>
            )}

            {/* Uploading State */}
            {isUploading && (
              <div className="mb-4 flex flex-col items-center gap-3 rounded-lg bg-violet-50 p-6 dark:bg-violet-900/20">
                <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
                <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                  Uploading photos...
                </p>
              </div>
            )}

            {isOptimizing && (
              <div className="mb-4 flex flex-col items-center gap-3 rounded-lg bg-amber-50 p-6 dark:bg-amber-900/20">
                <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Optimizing large photos...
                </p>
              </div>
            )}

            {!uploadSuccess && !isUploading && !isOptimizing && (
              <div className="space-y-4">
                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Selected Photos ({selectedFiles.length}/5)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={file.preview}
                            alt={file.name}
                            fill
                            className="object-cover"
                          />
                          <button
                            onClick={() => removeSelectedFile(index)}
                            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Selection Buttons */}
                {selectedFiles.length < 5 && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Camera Button */}
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-violet-50 to-pink-50 p-4 transition-all hover:border-violet-400 hover:from-violet-100 hover:to-pink-100 dark:from-violet-900/20 dark:to-pink-900/20">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                      />
                      <Camera className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        Camera
                      </span>
                    </label>

                    {/* Gallery Button */}
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-all hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 dark:hover:bg-gray-700">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                      />
                      <ImageIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        Gallery
                      </span>
                    </label>
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Large photos are optimized automatically before upload
                </p>

                {/* Caption */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Caption (optional)
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    maxLength={200}
                  />
                </div>

                {/* Lucky Draw Entry */}
                {!isAnonymous && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={joinLuckyDraw}
                        onChange={(e) => setJoinLuckyDraw(e.target.checked)}
                        disabled={hasJoinedDraw}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Join Lucky Draw
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Enter this photo into the lucky draw for a chance to win prizes!
                        </p>
                        {hasJoinedDraw && (
                          <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            ✓ You have already joined the lucky draw
                          </p>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {isAnonymous && (
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      ⚠️ Anonymous users cannot participate in the lucky draw
                    </p>
                  </div>
                )}

                {(isAnonymous || !guestName.trim()) && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
                    <Recaptcha
                      onVerified={(token) => {
                        setRecaptchaToken(token);
                        setRecaptchaError(null);
                      }}
                      onExpired={() => {
                        setRecaptchaToken(null);
                      }}
                      onError={(err) => setRecaptchaError(err)}
                    />
                    {recaptchaToken && (
                      <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                        CAPTCHA verified
                      </p>
                    )}
                    {!recaptchaToken && recaptchaError && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {recaptchaError}
                      </p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                {selectedFiles.length > 0 && (
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || isOptimizing}
                    className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 py-3 text-sm font-semibold text-white hover:from-violet-700 hover:to-pink-700 transition-all disabled:opacity-50"
                  >
                    Upload {selectedFiles.length} Photo{selectedFiles.length > 1 ? 's' : ''}
                  </button>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Up to 5 photos, max 10MB each
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Camera Button */}
      {event?.settings?.features?.photo_upload_enabled !== false && (
        <button
          onClick={() => {
            setShowUploadModal(true);
            setRecaptchaToken(null);
            setRecaptchaError(null);
          }}
          className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-2xl hover:from-violet-700 hover:to-pink-700 transition-all hover:scale-110 active:scale-95"
          aria-label="Quick photo upload"
        >
          <Camera className="h-8 w-8" />
        </button>
      )}
    </div>
  );
}
