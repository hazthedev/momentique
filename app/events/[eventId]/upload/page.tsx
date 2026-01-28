// ============================================
// MOMENTIQUE - Photo Upload Page
// ============================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, X, Check, AlertCircle, Loader2, Image as ImageIcon, Camera } from 'lucide-react';
import { validateImageFile, formatFileSize, cn } from '@/lib/utils';
import type { IEvent } from '@/lib/types';
import { getClientFingerprint } from '@/lib/fingerprint';
import { usePhotoGallery } from '@/lib/realtime/client';

interface PhotoPreview {
  file: File;
  preview: string;
  size: string;
  name: string;
}

export default function PhotoUploadPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [files, setFiles] = useState<PhotoPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { broadcastNewPhoto } = usePhotoGallery(eventId);
  const [eventHref, setEventHref] = useState(`/e/${eventId}`);

  useEffect(() => {
    setEventHref(`/e/${eventId}`);
  }, [eventId]);

  useEffect(() => {
    let isMounted = true;
    const resolveEventHref = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as { user?: { role?: string } | null };
        if (!isMounted) return;
        const role = data.user?.role;
        if (role === 'organizer' || role === 'admin' || role === 'super_admin') {
          setEventHref(`/organizer/events/${eventId}`);
        }
      } catch {
        // Default to guest view
      }
    };
    resolveEventHref();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Fetch event info
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        const data = await response.json();

        if (response.ok) {
          setEvent(data.data);
        } else {
          setErrors([data.error || 'Failed to load event']);
        }
      } catch (err) {
        setErrors(['Failed to load event']);
      } finally {
        setIsLoadingEvent(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      files.forEach(file => {
        URL.revokeObjectURL(file.preview);
      });
    };
  }, [files]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    addFiles(dropped);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    addFiles(selected);
    // Reset input so same files can be selected again if needed
    e.target.value = '';
  };

  const addFiles = (newFiles: File[]) => {
    setErrors([]);

    // Check total files limit
    if (files.length + newFiles.length > 5) {
      setErrors(['Maximum 5 photos per upload']);
      return;
    }

    const validPreviews: PhotoPreview[] = [];

    for (const file of newFiles) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setErrors(prev => [...prev, validation.error || 'Invalid file']);
        continue;
      }

      // Generate preview
      const preview = URL.createObjectURL(file);
      validPreviews.push({
        file,
        preview,
        size: formatFileSize(file.size),
        name: file.name,
      });
    }

    setFiles(prev => [...prev, ...validPreviews]);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(files[index].preview);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setErrors(prev => prev.filter(e => !e.includes(files[index].name)));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setErrors(['Please select at least one photo']);
      return;
    }

    setIsUploading(true);
    setErrors([]);

    try {
      const fingerprint = getClientFingerprint();
      const headers: Record<string, string> = {};
      if (fingerprint) {
        headers['x-fingerprint'] = fingerprint;
      }

      const formData = new FormData();
      files.forEach(p => formData.append('files', p.file));

      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      if (!isAnonymous && contributorName.trim()) {
        formData.append('contributor_name', contributorName.trim());
      }

      formData.append('is_anonymous', isAnonymous.toString());

      const response = await fetch(`/api/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const uploaded = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
        setUploadedCount(uploaded.length);
        uploaded.forEach((photo: any) => {
          broadcastNewPhoto(photo);
        });
        // Redirect to event page after showing success
        setTimeout(() => {
          router.push(eventHref);
          router.refresh();
        }, 1500);
      } else {
        setErrors([result.error || 'Upload failed']);
      }
    } catch (err) {
      console.error('[UPLOAD] Error:', err);
      setErrors(['Network error. Please try again.']);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoadingEvent) {
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
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-red-600 dark:text-red-400">
            {errors[0] || 'Event not found'}
          </p>
          <Link
            href="/events"
            className="mt-4 inline-block text-violet-600 hover:text-violet-700"
          >
            Back to Events
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
            href={eventHref}
            className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Upload Photos</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Share your memories from {event.name}
          </p>
        </div>

        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative mb-6 rounded-lg border-2 border-dashed p-8 text-center transition-all',
            isDragging
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
              : 'border-gray-300 dark:border-gray-600',
            files.length >= 5 && 'opacity-50'
          )}
        >
          {/* Hidden file inputs */}
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading || files.length >= 5}
          />
          <input
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading || files.length >= 5}
          />

          {/* Upload buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => document.getElementById('camera-input')?.click()}
              disabled={isUploading || files.length >= 5}
              className={cn(
                'flex flex-col items-center gap-2 px-6 py-4 rounded-lg border-2 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-gradient-to-br from-violet-500 to-pink-500 border-transparent hover:from-violet-600 hover:to-pink-600',
                'text-white shadow-lg hover:shadow-xl'
              )}
            >
              <Camera className="h-8 w-8" />
              <span className="font-medium">Take Photo</span>
              <span className="text-xs opacity-80">Open camera</span>
            </button>

            <button
              onClick={() => document.getElementById('file-input')?.click()}
              disabled={isUploading || files.length >= 5}
              className={cn(
                'flex flex-col items-center gap-2 px-6 py-4 rounded-lg border-2 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600',
                'hover:border-violet-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                'text-gray-900 dark:text-gray-100'
              )}
            >
              <ImageIcon className="h-8 w-8 text-violet-600" />
              <span className="font-medium">Choose from Gallery</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Browse files</span>
            </button>
          </div>

          {/* Drag-drop hint */}
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            {isDragging ? 'Drop photos here' : 'Or drag and drop files here'}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Up to 5 photos, max 10MB each (JPEG, PNG, WebP)
          </p>
        </div>

        {/* Previews */}
        {files.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {files.map((item, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={item.preview}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="truncate text-xs text-white">{item.name}</p>
                  <p className="text-xs text-gray-300">{item.size}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Options */}
        <div className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Upload Options
          </h3>

          {/* Caption */}
          <div>
            <label htmlFor="caption" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Caption (optional)
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              disabled={isUploading}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Add a caption to your photos..."
            />
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center">
            <input
              id="anonymous"
              type="checkbox"
              checked={isAnonymous}
              onChange={e => setIsAnonymous(e.target.checked)}
              disabled={isUploading}
              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600"
            />
            <label
              htmlFor="anonymous"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Upload anonymously
            </label>
          </div>

          {/* Contributor Name (shown if not anonymous) */}
          {!isAnonymous && (
            <div>
              <label htmlFor="contributor-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Your name (optional)
              </label>
              <input
                id="contributor-name"
                type="text"
                value={contributorName}
                onChange={e => setContributorName(e.target.value)}
                disabled={isUploading}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="Your name (optional)"
              />
            </div>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {errors.length === 1 ? 'Error' : 'Errors'}:
                </p>
                <ul className="mt-1 list-disc list-inside text-sm text-red-700 dark:text-red-400">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {uploadedCount > 0 && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {uploadedCount} photo{uploadedCount !== 1 ? 's' : ''} uploaded successfully!
                Redirecting...
              </p>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={isUploading || files.length === 0}
          className={cn(
            'w-full flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            {
              'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-700 hover:to-pink-700 focus:ring-violet-500':
                !isUploading,
              'bg-gray-400': isUploading,
            }
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Upload {files.length} Photo{files.length !== 1 ? 's' : ''}
            </>
          )}
        </button>

        {/* Info */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Note:</strong> By uploading photos, you agree to our terms of service.
            {event.settings?.features?.moderation_required && ' Photos will be reviewed before being visible to other participants.'}
          </p>
        </div>
      </div>
    </div>
  );
}
