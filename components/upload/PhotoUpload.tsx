// ============================================
// Galeria - Drag & Drop Photo Upload Component
// ============================================

'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle, Camera } from 'lucide-react';
import { validateImageFile, formatFileSize, getImageDimensions } from '@/lib/utils';
import { getClientFingerprint } from '@/lib/fingerprint';
import { usePhotoGallery } from '@/lib/realtime/client';
import type { IPhoto } from '@/lib/types';

// ============================================
// TYPES
// ============================================

interface PhotoUploadProps {
  eventId: string;
  onSuccess?: (photo: IPhoto) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

interface UploadFile {
  file: File;
  id: string;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// ============================================
// COMPONENT
// ============================================

export function PhotoUpload({
  eventId,
  onSuccess,
  onError,
  maxFiles = 5,
  disabled = false,
  className,
}: PhotoUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { broadcastNewPhoto } = usePhotoGallery(eventId);

  const remainingSlots = maxFiles - files.filter(f => f.status !== 'error').length;

  // ============================================
  // DRAG & DROP HANDLERS
  // ============================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [disabled, isUploading, files.length, maxFiles]
  );

  // ============================================
  // FILE INPUT HANDLERS
  // ============================================

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      addFiles(selectedFiles);

      // Reset both inputs
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    },
    [disabled, isUploading, files.length, maxFiles]
  );

  // ============================================
  // ADD FILES TO QUEUE
  // ============================================

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const validFiles: UploadFile[] = [];
      const errors: string[] = [];

      newFiles.forEach((file) => {
        // Check if we have room
        if (validFiles.length + files.filter(f => f.status !== 'error').length >= maxFiles) {
          errors.push(`${file.name}: Maximum ${maxFiles} files allowed`);
          return;
        }

        // Validate file
        const validation = validateImageFile(file);
        if (!validation.valid) {
          errors.push(`${file.name}: ${validation.error}`);
          return;
        }

        // Create preview
        const preview = URL.createObjectURL(file);

        validFiles.push({
          file,
          id: Math.random().toString(36).substring(7),
          preview,
          progress: 0,
          status: 'pending',
        });
      });

      if (errors.length > 0) {
        onError?.(errors.join('\n'));
      }

      setFiles((prev) => [...prev, ...validFiles]);
    },
    [files.length, maxFiles, onError]
  );

  // ============================================
  // REMOVE FILE FROM QUEUE
  // ============================================

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // ============================================
  // UPLOAD FILES
  // ============================================

  const uploadFiles = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    for (const fileData of pendingFiles) {
      try {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id ? { ...f, status: 'uploading', progress: 0 } : f
          )
        );

        const fingerprint = getClientFingerprint();
        const presignRes = await fetch(`/api/events/${eventId}/photos/presign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
          },
          body: JSON.stringify({
            filename: fileData.file.name,
            contentType: fileData.file.type,
            fileSize: fileData.file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to get upload URL');
        }

        const presignData = await presignRes.json();
        const { uploadUrl, key, photoId } = presignData.data || {};

        if (!uploadUrl || !key || !photoId) {
          throw new Error('Invalid presign response');
        }

        // Upload directly to R2 with progress tracking
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileData.id ? { ...f, progress } : f
              )
            );
          }
        };

        const uploadPromise = new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error('Upload failed'));
            }
          };

          xhr.onerror = () => reject(new Error('Upload failed'));

          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', fileData.file.type || 'application/octet-stream');
          xhr.send(fileData.file);
        });

        await uploadPromise;

        // Finalize upload (store metadata in DB)
        const dimensions = await getImageDimensions(fileData.file);
        const finalizeRes = await fetch(`/api/events/${eventId}/photos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
          },
          body: JSON.stringify({
            photoId,
            key,
            width: dimensions.width,
            height: dimensions.height,
            fileSize: fileData.file.size,
            caption: undefined,
            contributorName: undefined,
            isAnonymous: false,
            joinLuckyDraw: false,
          }),
        });

        if (!finalizeRes.ok) {
          const err = await finalizeRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to finalize upload');
        }

        const response = await finalizeRes.json();
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id ? { ...f, status: 'success', progress: 100 } : f
          )
        );
        const payload = response.data;
        const uploaded = Array.isArray(payload) ? payload : payload ? [payload] : [];
        uploaded.forEach((photo) => {
          onSuccess?.(photo);
          broadcastNewPhoto(photo);
        });
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' } : f
          )
        );
      }
    }

    setIsUploading(false);
  }, [files, eventId, onSuccess]);

  // ============================================
  // CLEAR COMPLETED FILES
  // ============================================

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
  }, []);

  // ============================================
  // CLEAR ALL FILES
  // ============================================

  const clearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
  }, [files]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={className}>
      {/* Drag & Drop Zone */}
      {!disabled && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center
            transition-colors duration-200
            ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950' : 'border-gray-300 dark:border-gray-700'}
            ${isUploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          {/* Hidden file inputs */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/webp"
            multiple
            max={maxFiles}
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled || isUploading}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled || isUploading}
          />

          {/* Upload buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading || remainingSlots <= 0}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                bg-gradient-to-br from-violet-500 to-pink-500 border-transparent hover:from-violet-600 hover:to-pink-600
                text-white shadow-md hover:shadow-lg
              `}
            >
              <Camera className="h-5 w-5" />
              <span className="font-medium">Take Photo</span>
            </button>

            <button
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || remainingSlots <= 0}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600
                hover:border-violet-400 hover:bg-gray-50 dark:hover:bg-gray-700
                text-gray-900 dark:text-gray-100
              `}
            >
              <ImageIcon className="h-5 w-5 text-violet-600" />
              <span className="font-medium">Choose Files</span>
            </button>
          </div>

          {/* Drag-drop hint */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isDragging ? 'Drop photos here' : 'Or drag and drop files'}
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {remainingSlots > 0
              ? `${remainingSlots} file${remainingSlots > 1 ? 's' : ''} remaining (max ${maxFiles})`
              : 'Maximum files reached'}
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            JPEG, PNG, HEIC, WebP • Max 10MB
          </p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-16 flex-shrink-0">
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}

                {/* Status Icon */}
                {file.status === 'success' && (
                  <div className="absolute inset-0 bg-green-500/20 rounded flex items-center justify-center">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {file.file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(file.file.size)}
                </p>

                {/* Progress Bar */}
                {file.status === 'uploading' && (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {file.progress}%
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {file.status === 'error' && file.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {file.error}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {file.status === 'uploading' && (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}

                {(file.status === 'pending' || file.status === 'error') && (
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                    disabled={isUploading}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {files.some((f) => f.status === 'pending') && (
              <button
                onClick={uploadFiles}
                disabled={isUploading || disabled}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Photos
                  </>
                )}
              </button>
            )}

            {files.some((f) => f.status === 'success') && (
              <button
                onClick={clearCompleted}
                disabled={isUploading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Clear Completed
              </button>
            )}

            {files.length > 0 && (
              <button
                onClick={clearAll}
                disabled={isUploading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
