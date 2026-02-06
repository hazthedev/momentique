// ============================================
// Gatherly - Guest Event Page (Shareable Link)
// ============================================
// Public event page for guests - no authentication required

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  UserCheck,
  Gift,
  Target,
} from 'lucide-react';
import { PhotoChallengeProgressBar } from '@/components/photo-challenge/progress-bar';
import { PhotoChallengePrizeModal } from '@/components/photo-challenge/prize-modal';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import type { IEvent, IPhoto, IPhotoChallenge, IGuestPhotoProgress } from '@/lib/types';
import { getClientFingerprint } from '@/lib/fingerprint';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { useLuckyDraw } from '@/lib/realtime/client';
import { SlotMachineAnimation } from '@/components/lucky-draw/SlotMachineAnimation';
import { CheckInModal } from '@/components/attendance/CheckInModal';
import {
  photoCardVariants,
  modalBackdropVariants,
  modalContentVariants,
  luckyNumberVariants,
  heartBurstVariants,
  heartParticleVariants,
  floatingButtonVariants,
  fileCardVariants,
  counterVariants,
  greetingModalVariants,
  springConfigs,
  createParticleBurst,
} from '@/lib/animations';

// ============================================
// TYPES
// ============================================

interface SelectedFile {
  file: File;
  preview: string;
  name: string;
}

const GUEST_MAX_DIMENSION = 4000;
const PHOTO_PAGE_SIZE = 5;
const PHOTO_CARD_STYLE_CLASSES: Record<string, string> = {
  vacation: 'rounded-2xl bg-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5',
  brutalist: 'rounded-none bg-white border-2 border-black shadow-[6px_6px_0_#000]',
  wedding: 'rounded-3xl bg-white border border-rose-200 shadow-[0_8px_24px_rgba(244,114,182,0.25)]',
  celebration: 'rounded-2xl bg-gradient-to-br from-yellow-50 via-white to-pink-50 border border-amber-200 shadow-[0_10px_26px_rgba(249,115,22,0.25)]',
  futuristic: 'rounded-2xl bg-slate-950/90 border border-cyan-400/40 shadow-[0_0_24px_rgba(34,211,238,0.35)]',
};

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

function mergePhotos(approved: IPhoto[], pending: IPhoto[], rejected: IPhoto[]): IPhoto[] {
  const merged = new Map<string, IPhoto>();
  const add = (photo: IPhoto) => {
    const existing = merged.get(photo.id);
    if (!existing) {
      merged.set(photo.id, photo);
      return;
    }
    if (existing.status === 'approved' && photo.status !== 'approved') {
      merged.set(photo.id, photo);
    }
  };
  approved.forEach(add);
  pending.forEach(add);
  rejected.forEach(add);
  return Array.from(merged.values());
}

function formatDrawNumber(entryId?: string | null) {
  if (!entryId) return '----';
  const clean = entryId.replace(/-/g, '');
  if (!clean) return '----';
  return clean.slice(-4).toUpperCase().padStart(4, '0');
}

function formatEntryNumbers(entryIds: Array<string | null | undefined>) {
  const formatted = entryIds
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => formatDrawNumber(id))
    .filter((value) => value !== '----');
  return formatted;
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function isColorDark(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.5;
}

function hexToRgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
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
  themeGradient,
  themeSurface,
  themeSecondary,
  secondaryText,
  surfaceText,
  surfaceMuted,
  surfaceBorder,
  inputBackground,
  inputBorder,
  allowAnonymous = true,
}: {
  isOpen: boolean;
  onSubmit: (name: string, isAnonymous: boolean) => void;
  eventName: string;
  initialName?: string;
  initialAnonymous?: boolean;
  themeGradient?: string;
  themeSurface: string;
  themeSecondary: string;
  secondaryText: string;
  surfaceText: string;
  surfaceMuted: string;
  surfaceBorder: string;
  inputBackground: string;
  inputBorder: string;
  allowAnonymous?: boolean;
}) {
  const [name, setName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    setName(initialName || '');
    setIsAnonymous(allowAnonymous ? !!initialAnonymous : false);
    setError('');
  }, [isOpen, initialName, initialAnonymous, allowAnonymous]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = () => {
    if (!isAnonymous && !name.trim()) {
      setError('Please enter your name or choose anonymous');
      return;
    }
    onSubmit(isAnonymous ? '' : name.trim(), isAnonymous);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        variants={modalBackdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          variants={greetingModalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
          style={{ backgroundColor: themeSurface, color: surfaceText, borderColor: surfaceBorder }}
        >
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: themeSecondary }}
          >
            <User className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: surfaceText }}>
            Welcome to {eventName}!
          </h2>
          <p className="mt-2 text-sm" style={{ color: surfaceMuted }}>
            Please enter your name to get started
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ color: surfaceText }}>
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
                "w-full rounded-lg border px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500",
                isAnonymous ? "text-gray-400" : ""
              )}
              style={{
                backgroundColor: inputBackground,
                borderColor: inputBorder,
                color: surfaceText,
                opacity: isAnonymous ? 0.7 : 1,
              }}
              maxLength={100}
            />
          </div>

          {allowAnonymous ? (
            <label
              className="flex items-center gap-3 cursor-pointer rounded-lg border p-3"
              style={{ borderColor: inputBorder, backgroundColor: inputBackground }}
            >
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked);
                  setError('');
                }}
                className="h-4 w-4 rounded focus:ring-2"
                style={{ borderColor: inputBorder, color: themeSecondary }}
              />
              <div>
                <span className="text-sm font-medium" style={{ color: surfaceText }}>
                  Stay Anonymous
                </span>
                <p className="text-xs" style={{ color: surfaceMuted }}>
                  Your name won&apos;t be shown on photos
                </p>
              </div>
            </label>
          ) : (
            <div
              className="rounded-lg border p-3 text-xs"
              style={{ borderColor: surfaceBorder, backgroundColor: inputBackground, color: surfaceMuted }}
            >
              Anonymous uploads are disabled for this event.
            </div>
          )}

          {isAnonymous && (
            <div className="rounded-lg p-3" style={{ backgroundColor: hexToRgba('#F59E0B', 0.15) }}>
              <p className="text-xs" style={{ color: '#F59E0B' }}>
                ?????? Anonymous users cannot participate in the lucky draw
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
          )}

          <button
            onClick={handleSubmit}
            className="w-full rounded-lg py-3 text-sm font-semibold transition-all"
            style={{ backgroundColor: themeSecondary, color: secondaryText }}
          >
            Continue
          </button>
        </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
  const [approvedPhotos, setApprovedPhotos] = useState<IPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<IPhoto[]>([]);
  const [rejectedPhotos, setRejectedPhotos] = useState<IPhoto[]>([]);
  const [approvedTotal, setApprovedTotal] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreApproved, setHasMoreApproved] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('Photo uploaded successfully!');
  const [optimizedCount, setOptimizedCount] = useState(0);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);
  const [moderationNoticeType, setModerationNoticeType] = useState<'approved' | 'rejected' | null>(null);
  const [joinLuckyDraw, setJoinLuckyDraw] = useState(true);
  const [hasJoinedDraw, setHasJoinedDraw] = useState(false);
  const [luckyDrawNumbers, setLuckyDrawNumbers] = useState<string[]>([]);
  const [hasActiveLuckyDrawConfig, setHasActiveLuckyDrawConfig] = useState<boolean | null>(null);
  const [photoChallenge, setPhotoChallenge] = useState<IPhotoChallenge | null>(null);
  const [challengeProgress, setChallengeProgress] = useState<IGuestPhotoProgress | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const fingerprint = useMemo(() => getClientFingerprint(), []);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);
  const { winner, isDrawing } = useLuckyDraw(resolvedEventId || '');
  const [showDrawOverlay, setShowDrawOverlay] = useState(false);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const rejectedIdsRef = useRef<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const mergedPhotos = useMemo(
    () => mergePhotos(approvedPhotos, pendingPhotos, rejectedPhotos),
    [approvedPhotos, pendingPhotos, rejectedPhotos]
  );

  // Guest name state (persisted)
  const [guestName, setGuestName] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const allowAnonymous = event?.settings?.features?.anonymous_allowed !== false;
  const moderationRequired = event?.settings?.features?.moderation_required || false;
  const luckyDrawEnabled = event?.settings?.features?.lucky_draw_enabled !== false;
  const attendanceEnabled = event?.settings?.features?.attendance_enabled !== false;
  const photoCardStyle = event?.settings?.theme?.photo_card_style || 'vacation';
  const themePrimary = event?.settings?.theme?.primary_color || '#8B5CF6';
  const themeSecondary = event?.settings?.theme?.secondary_color || '#EC4899';
  const themeBackground = event?.settings?.theme?.background || '#F9FAFB';
  const isGradientBackground = themeBackground.includes('gradient');
  const themeSurface = isGradientBackground ? '#FFFFFF' : themeBackground;
  const themeGradient = themePrimary;
  const surfaceIsDark = isColorDark(themeSurface);
  const surfaceText = surfaceIsDark ? '#F8FAFC' : '#0F172A';
  const surfaceMuted = surfaceIsDark ? '#CBD5F5' : '#475569';
  const surfaceBorder = surfaceIsDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
  const inputBackground = surfaceIsDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.04)';
  const inputBorder = themePrimary;
  const headerBackground = hexToRgba(themeSurface, 0.88);
  const primaryText = isColorDark(themePrimary) ? '#F8FAFC' : '#0F172A';
  const secondaryText = isColorDark(themeSecondary) ? '#F8FAFC' : '#0F172A';

  // Selected files for upload (preview before submit)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [caption, setCaption] = useState('');

  // Track user's love reactions (max 10 per photo per user)
  const [userLoves, setUserLoves] = useState<Record<string, number>>({});

  // Track which photos are currently showing the heart animation
  const [animatingPhotos, setAnimatingPhotos] = useState<Set<string>>(new Set());
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const canDownload = event?.settings?.features?.guest_download_enabled !== false;
  const selectedCount = selectedPhotoIds.size;

  // Load guest name from localStorage on mount
  useEffect(() => {
    if (!resolvedEventId) return;
    const storageKey = `guest_name_${resolvedEventId}`;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setGuestName(parsed.name || '');
        setIsAnonymous(allowAnonymous ? parsed.isAnonymous || false : false);
      } catch {
        // Show modal if no valid data
        setShowGuestModal(true);
      }
    } else {
      setShowGuestModal(true);
    }
  }, [resolvedEventId, allowAnonymous]);

  useEffect(() => {
    if (!resolvedEventId) return;
    const storageKey = `lucky_draw_numbers_${resolvedEventId}`;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const numbers = parsed.filter((value) => typeof value === 'string');
        setLuckyDrawNumbers(numbers);
        if (numbers.length > 0) {
          setHasJoinedDraw(true);
          setJoinLuckyDraw(false);
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, [resolvedEventId]);

  useEffect(() => {
    if (!resolvedEventId) return;
    const storageKey = `lucky_draw_joined_${resolvedEventId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved === 'true') {
      setHasJoinedDraw(true);
      setJoinLuckyDraw(false);
    }
  }, [resolvedEventId]);

  useEffect(() => {
    if (hasJoinedDraw && joinLuckyDraw) {
      setJoinLuckyDraw(false);
    }
  }, [hasJoinedDraw, joinLuckyDraw]);

  useEffect(() => {
    if (!allowAnonymous && isAnonymous) {
      setIsAnonymous(false);
    }
  }, [allowAnonymous, isAnonymous]);

  useEffect(() => {
    if (!luckyDrawEnabled && joinLuckyDraw) {
      setJoinLuckyDraw(false);
    }
  }, [luckyDrawEnabled, joinLuckyDraw]);

  useEffect(() => {
    if (!resolvedEventId || !luckyDrawEnabled) return;
    const loadLuckyDrawConfig = async () => {
      try {
        const response = await fetch(`/api/events/${resolvedEventId}/lucky-draw/config?active=true`);
        const data = await response.json();
        const active = !!data?.data;
        setHasActiveLuckyDrawConfig(active);
        if (!active) {
          setJoinLuckyDraw(false);
        }
      } catch (err) {
        console.debug('[GUEST_EVENT] Lucky draw config fetch failed:', err);
        setHasActiveLuckyDrawConfig(null);
      }
    };
    loadLuckyDrawConfig();
  }, [resolvedEventId, luckyDrawEnabled]);

  // Load photo challenge config and progress
  useEffect(() => {
    if (!resolvedEventId || !fingerprint) return;
    const photoChallengeEnabled = event?.settings?.features?.photo_challenge_enabled;
    if (!photoChallengeEnabled) return;

    const loadPhotoChallenge = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (fingerprint) headers['x-fingerprint'] = fingerprint;
        if (event?.tenant_id) headers['x-tenant-id'] = event.tenant_id;

        const [configRes, progressRes] = await Promise.all([
          fetch(`/api/events/${resolvedEventId}/photo-challenge`, { headers }),
          fetch(`/api/events/${resolvedEventId}/photo-challenge/progress`, { headers }),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setPhotoChallenge(configData.data);
        } else {
          console.error('[GUEST_EVENT] Photo challenge config fetch failed:', configRes.status, await configRes.text());
        }

        if (progressRes.ok) {
          const progressData = await progressRes.json();
          setChallengeProgress(progressData.data);
        } else {
          console.error('[GUEST_EVENT] Photo challenge progress fetch failed:', progressRes.status, await progressRes.text());
        }
      } catch (err) {
        console.error('[GUEST_EVENT] Photo challenge fetch failed:', err);
      }
    };
    loadPhotoChallenge();
  }, [resolvedEventId, fingerprint, event]);

  // Show prize modal when goal is reached (auto-grant only)
  useEffect(() => {
    if (!photoChallenge?.auto_grant || !challengeProgress) return;
    if (challengeProgress.goal_reached && !challengeProgress.prize_claimed_at && !challengeProgress.prize_revoked) {
      setShowPrizeModal(true);
    }
  }, [photoChallenge, challengeProgress]);

  // Check if user has already checked in
  useEffect(() => {
    if (!resolvedEventId || !fingerprint || !attendanceEnabled) return;

    const checkAttendanceStatus = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (fingerprint) headers['x-fingerprint'] = fingerprint;

        const response = await fetch(`/api/events/${resolvedEventId}/attendance/my`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            setHasCheckedIn(true);
            // Mark user as non-anonymous after check-in so progress bar shows
            setIsAnonymous(false);
            // Store the guest name from attendance
            if (data.data.guest_name) {
              setGuestName(data.data.guest_name);
            }
          }
        }
      } catch (err) {
        console.debug('[GUEST_EVENT] Attendance check failed:', err);
      }
    };
    checkAttendanceStatus();
  }, [resolvedEventId, fingerprint, attendanceEnabled]);

  useEffect(() => {
    if (hasActiveLuckyDrawConfig === false && joinLuckyDraw) {
      setJoinLuckyDraw(false);
    }
  }, [hasActiveLuckyDrawConfig, joinLuckyDraw]);

  // Handle guest modal submit
  const handleGuestModalSubmit = (name: string, anonymous: boolean) => {
    const nextAnonymous = allowAnonymous ? anonymous : false;
    setGuestName(name);
    setIsAnonymous(nextAnonymous);
    setShowGuestModal(false);

    // If anonymous or lucky draw disabled, can't join
    if (nextAnonymous || !luckyDrawEnabled) {
      setJoinLuckyDraw(false);
    } else if (!hasJoinedDraw) {
      setJoinLuckyDraw(true);
    }

    // Save to localStorage
    if (resolvedEventId) {
      const storageKey = `guest_name_${resolvedEventId}`;
      localStorage.setItem(storageKey, JSON.stringify({ name, isAnonymous: nextAnonymous }));
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

  const updatePhotoById = useCallback((photoId: string, updater: (photo: IPhoto) => IPhoto) => {
    setApprovedPhotos((prev) => prev.map((photo) => (photo.id === photoId ? updater(photo) : photo)));
    setPendingPhotos((prev) => prev.map((photo) => (photo.id === photoId ? updater(photo) : photo)));
    setRejectedPhotos((prev) => prev.map((photo) => (photo.id === photoId ? updater(photo) : photo)));
  }, []);

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

  useEffect(() => {
    if (!moderationNotice) return;
    const timeout = setTimeout(() => {
      setModerationNotice(null);
      setModerationNoticeType(null);
    }, 6000);
    return () => clearTimeout(timeout);
  }, [moderationNotice]);

  useEffect(() => {
    if (!canDownload) {
      setSelectedPhotoIds(new Set());
      return;
    }
    const approvedIds = new Set(mergedPhotos.filter((photo) => photo.status === 'approved').map((photo) => photo.id));
    setSelectedPhotoIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => approvedIds.has(id)));
      return next;
    });
  }, [canDownload, mergedPhotos]);

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
          updatePhotoById(photoId, (photo) => ({
            ...photo,
            reactions: {
              ...photo.reactions,
              heart: data.data?.count ?? (photo.reactions.heart || 0) + 1,
            },
          }));
        }
      }
    } catch (err) {
      console.error('[GUEST_EVENT] Love reaction error:', err);
    }
  };

  // Download photo
  const handleDownloadPhoto = async (photo: IPhoto) => {
    try {
      const response = await fetch(`/api/photos/${photo.id}/download?format=png`);
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

  const handleDownloadSelected = async () => {
    if (selectedPhotoIds.size === 0) return;
    const targetEventId = resolvedEventId || eventId;
    if (!targetEventId) return;

    try {
      const response = await fetch(`/api/events/${targetEventId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: Array.from(selectedPhotoIds) }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `event-${targetEventId}-selected.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[GUEST_EVENT] Selected download error:', err);
    }
  };

  const handleDownloadSelectedIndividually = async () => {
    if (selectedPhotoIds.size === 0) return;
    const photoIds = Array.from(selectedPhotoIds);

    // Pre-fetch all photos first to minimize delays between downloads
    const downloads: Array<{ blob: Blob; filename: string }> = [];

    for (const photoId of photoIds) {
      try {
        const response = await fetch(`/api/photos/${photoId}/download?format=png`);
        if (!response.ok) {
          throw new Error('Download failed');
        }
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `photo-${photoId}.png`;
        downloads.push({ blob, filename });
      } catch (err) {
        console.error('[GUEST_EVENT] Individual download error:', err);
      }
    }

    // Trigger downloads with proper timing
    for (let i = 0; i < downloads.length; i++) {
      const { blob, filename } = downloads[i];
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);

      // Use a longer delay to ensure browser processes each download
      setTimeout(() => {
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 100);
      }, i * 1000);
    }
  };

  const toggleSelectedPhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
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

        const moderationRequired = eventData.data?.settings?.features?.moderation_required || false;
        const headers: Record<string, string> = {};
        if (fingerprint) {
          headers['x-fingerprint'] = fingerprint;
        }

        // Fetch photos (approved for everyone, plus own pending/rejected if moderation enabled)
        const approvedResponse = await fetch(
          `/api/events/${actualEventId}/photos?status=approved&limit=${PHOTO_PAGE_SIZE}&offset=0`,
          { headers }
        );
        const approvedData = await approvedResponse.json();

        let pendingData: { data?: IPhoto[] } = {};
        let rejectedData: { data?: IPhoto[] } = {};

        if (moderationRequired && fingerprint) {
          const [pendingRes, rejectedRes] = await Promise.all([
            fetch(`/api/events/${actualEventId}/photos?status=pending`, { headers }),
            fetch(`/api/events/${actualEventId}/photos?status=rejected`, { headers }),
          ]);

          pendingData = await pendingRes.json();
          rejectedData = await rejectedRes.json();
        }

        if (approvedResponse.ok) {
          const approvedList = approvedData.data || [];
          const pendingList = pendingData.data || [];
          const rejectedList = rejectedData.data || [];
          const nextTotal = approvedData.pagination?.total ?? approvedList.length;

          setApprovedPhotos(approvedList);
          setPendingPhotos(pendingList);
          setRejectedPhotos(rejectedList);
          setApprovedTotal(nextTotal);
          setHasMoreApproved(approvedList.length < nextTotal);
          pendingIdsRef.current = new Set(pendingList.map((p) => p.id));
          rejectedIdsRef.current = new Set(rejectedList.map((p) => p.id));
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

  const loadMoreApproved = useCallback(async () => {
    if (!resolvedEventId || isLoadingMore || !hasMoreApproved) return;
    setIsLoadingMore(true);
    try {
      const headers: Record<string, string> = {};
      if (fingerprint) {
        headers['x-fingerprint'] = fingerprint;
      }
      const offset = approvedPhotos.length;
      const response = await fetch(
        `/api/events/${resolvedEventId}/photos?status=approved&limit=${PHOTO_PAGE_SIZE}&offset=${offset}`,
        { headers }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load more photos');
      }

      const incoming = data.data || [];
      const nextTotal = data.pagination?.total ?? approvedTotal ?? offset + incoming.length;
      setApprovedTotal(nextTotal);
      setApprovedPhotos((prev) => {
        const existingIds = new Set(prev.map((photo) => photo.id));
        const deduped = incoming.filter((photo: IPhoto) => !existingIds.has(photo.id));
        return deduped.length > 0 ? [...prev, ...deduped] : prev;
      });
      const nextCount = offset + incoming.length;
      setHasMoreApproved(nextCount < nextTotal);
    } catch (err) {
      console.error('[GUEST_EVENT] Load more photos error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [resolvedEventId, isLoadingMore, hasMoreApproved, fingerprint, approvedPhotos.length, approvedTotal]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreApproved) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreApproved();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMoreApproved, hasMoreApproved]);

  useEffect(() => {
    if (approvedTotal === null) return;
    setHasMoreApproved(approvedPhotos.length < approvedTotal);
  }, [approvedPhotos.length, approvedTotal]);

  useEffect(() => {
    if (!resolvedEventId || !fingerprint || !moderationRequired) return;

    let isCancelled = false;
    const headers: Record<string, string> = { 'x-fingerprint': fingerprint };

    const pollStatuses = async () => {
      try {
        const [pendingRes, rejectedRes] = await Promise.all([
          fetch(`/api/events/${resolvedEventId}/photos?status=pending`, { headers }),
          fetch(`/api/events/${resolvedEventId}/photos?status=rejected`, { headers }),
        ]);

        const pendingJson = await pendingRes.json();
        const rejectedJson = await rejectedRes.json();

        if (!pendingRes.ok || !rejectedRes.ok) return;
        if (isCancelled) return;

        const nextPending = new Set<string>((pendingJson.data || []).map((p: IPhoto) => p.id));
        const nextRejected = new Set<string>((rejectedJson.data || []).map((p: IPhoto) => p.id));

        const prevPending = pendingIdsRef.current;
        const prevRejected = rejectedIdsRef.current;

        const newlyApproved: string[] = [];
        const newlyRejected: string[] = [];

        prevPending.forEach((id) => {
          if (!nextPending.has(id) && nextRejected.has(id)) {
            newlyRejected.push(id);
          } else if (!nextPending.has(id) && !nextRejected.has(id)) {
            newlyApproved.push(id);
          }
        });

        pendingIdsRef.current = nextPending;
        rejectedIdsRef.current = nextRejected;

        if (newlyApproved.length > 0) {
          setModerationNoticeType('approved');
          setModerationNotice('Your photo was approved!');
        }

        if (newlyRejected.length > 0) {
          setModerationNoticeType('rejected');
          setModerationNotice('Your photo was rejected.');
        }

        let newlyApprovedPhotos: IPhoto[] = [];
        setPendingPhotos((prev) => {
          newlyApprovedPhotos = prev
            .filter((photo) => newlyApproved.includes(photo.id))
            .map((photo) => ({ ...photo, status: 'approved' }));
          return pendingJson.data || [];
        });
        setRejectedPhotos(rejectedJson.data || []);

        if (newlyApprovedPhotos.length > 0) {
          setApprovedPhotos((prev) => {
            const existingIds = new Set(prev.map((photo) => photo.id));
            const additions = newlyApprovedPhotos.filter((photo) => !existingIds.has(photo.id));
            return additions.length > 0 ? [...additions, ...prev] : prev;
          });
          setApprovedTotal((prev) => (prev === null ? prev : prev + newlyApprovedPhotos.length));
        }
      } catch (err) {
        console.error('[GUEST_EVENT] Moderation poll error:', err);
      }
    };

    pollStatuses();
    const interval = setInterval(pollStatuses, 15000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [resolvedEventId, fingerprint, moderationRequired]);

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
      if (luckyDrawEnabled && joinLuckyDraw && !isAnonymous) {
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
        const code = typeof data?.code === 'string' ? data.code : '';
        if (code === 'TIER_LIMIT_REACHED' || code === 'EVENT_LIMIT_REACHED') {
          throw new Error('Photo uploads are full for this event.');
        }
        throw new Error(data.error || 'Failed to upload photo');
      }

      // Add the new photo(s) to the gallery
      const uploadedPhotos = Array.isArray(data.data) ? data.data : [data.data];
      const nextApproved = uploadedPhotos.filter((photo: IPhoto) => photo.status === 'approved');
      const nextPending = uploadedPhotos.filter((photo: IPhoto) => photo.status === 'pending');
      const nextRejected = uploadedPhotos.filter((photo: IPhoto) => photo.status === 'rejected');
      if (nextApproved.length > 0) {
        setApprovedPhotos((prev) => [...nextApproved, ...prev]);
        setApprovedTotal((prev) => (prev === null ? prev : prev + nextApproved.length));
      }
      if (nextPending.length > 0) {
        setPendingPhotos((prev) => [...nextPending, ...prev]);
      }
      if (nextRejected.length > 0) {
        setRejectedPhotos((prev) => [...nextRejected, ...prev]);
      }
      const hasPending = uploadedPhotos.some((photo: IPhoto) => photo.status === 'pending');
      if (hasPending) {
        setUploadSuccessMessage('Photo uploaded and pending approval.');
      } else {
        setUploadSuccessMessage('Photo uploaded successfully!');
      }

      const entryIds = uploadedPhotos.map((photo: IPhoto & { lucky_draw_entry_id?: string | null }) =>
        photo.lucky_draw_entry_id
      );
      const formattedEntryNumbers = formatEntryNumbers(entryIds);

      // If successfully joined the draw, mark as joined
      if (joinLuckyDraw && !isAnonymous) {
        setHasJoinedDraw(true);
        setJoinLuckyDraw(false);
        if (resolvedEventId) {
          const joinedKey = `lucky_draw_joined_${resolvedEventId}`;
          localStorage.setItem(joinedKey, 'true');
        }
        if (formattedEntryNumbers.length > 0) {
          const list = formattedEntryNumbers.join(', ');
          setUploadSuccessMessage(
            formattedEntryNumbers.length === 1
              ? `Your lucky draw number is ${list}.`
              : `Your lucky draw numbers are ${list}.`
          );
          setLuckyDrawNumbers((prev) => {
            const next = Array.from(new Set([...prev, ...formattedEntryNumbers]));
            if (resolvedEventId) {
              const storageKey = `lucky_draw_numbers_${resolvedEventId}`;
              localStorage.setItem(storageKey, JSON.stringify(next));
            }
            return next;
          });
        } else {
          setUploadSuccessMessage('You are in the lucky draw. Your number will appear shortly.');
        }
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
        setUploadSuccessMessage('Photo uploaded successfully!');
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

  return (
    <div className="min-h-screen" style={{ background: themeBackground }}>
      {/* Guest Name Modal */}
      <GuestNameModal
        isOpen={showGuestModal}
        onSubmit={handleGuestModalSubmit}
        eventName={event.name}
        initialName={guestName}
        initialAnonymous={isAnonymous}
        themeGradient={themeGradient}
        themeSurface={themeSurface}
        themeSecondary={themeSecondary}
        secondaryText={secondaryText}
        surfaceText={surfaceText}
        surfaceMuted={surfaceMuted}
        surfaceBorder={surfaceBorder}
        inputBackground={inputBackground}
        inputBorder={inputBorder}
        allowAnonymous={allowAnonymous}
      />

      {/* Lucky Draw Overlays */}
      {showDrawOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl"
            style={{ backgroundColor: themeSurface, color: surfaceText, borderColor: surfaceBorder }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: surfaceText }}>
                Lucky Draw
              </h3>
              <button
                onClick={() => setShowDrawOverlay(false)}
                className="hover:opacity-80"
                style={{ color: surfaceMuted }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
              <p className="text-sm font-medium" style={{ color: surfaceText }}>
                The lucky draw is starting...
              </p>
              <p className="text-xs" style={{ color: surfaceMuted }}>
                Stay tuned for the winner announcement.
              </p>
            </div>
          </div>
        </div>
      )}

      {showWinnerOverlay && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 text-center shadow-2xl"
            style={{ backgroundColor: themeSurface, color: surfaceText, borderColor: surfaceBorder }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: surfaceText }}>
                Winner Announced
              </h3>
              <button
                onClick={() => setShowWinnerOverlay(false)}
                className="hover:opacity-80"
                style={{ color: surfaceMuted }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SlotMachineAnimation
              durationSeconds={5}
              numberString={formatDrawNumber(winner.entry_id)}
              participantName={winner.participant_name || 'Anonymous'}
              photoUrl={winner.selfie_url}
              prizeName={`Prize Tier ${winner.prize_tier}`}
              showSelfie
              showFullName
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-sm"
        style={{ backgroundColor: headerBackground, borderColor: surfaceBorder }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold" style={{ color: surfaceText }}>
                {event.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {event.custom_hashtag && (
                  <span style={{ color: surfaceMuted }}>
                    #{event.custom_hashtag}
                  </span>
                )}
                {(guestName || isAnonymous) && (
                  <span style={{ color: surfaceMuted }}>
                    Hi, {isAnonymous ? 'Anonymous' : guestName}!
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
              {luckyDrawEnabled && (
                <a
                  href="#lucky-draw"
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
                  style={{
                    backgroundColor: themeSecondary,
                    color: secondaryText,
                    borderColor: surfaceBorder,
                  }}
                >
                  <Trophy className="h-4 w-4" />
                  Lucky Draw
                </a>
              )}
              {canDownload && (
                <>
                  {selectedCount > 0 && (
                    <>
                      <button
                        onClick={handleDownloadSelectedIndividually}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
                        style={{
                          backgroundColor: themeSecondary,
                          color: secondaryText,
                          borderColor: surfaceBorder,
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download selected ({selectedCount})
                      </button>
                      <button
                        onClick={handleDownloadSelected}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
                        style={{ color: surfaceText, borderColor: surfaceBorder }}
                      >
                        <Download className="h-4 w-4" />
                        Download ZIP ({selectedCount})
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
                    style={{ color: surfaceText, borderColor: surfaceBorder }}
                  >
                    <Download className="h-4 w-4" />
                    Download all
                  </button>
                </>
              )}
              <button
                onClick={() => setShowGuestModal(true)}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium"
                style={{ color: surfaceText, borderColor: themeSecondary }}
              >
                {isAnonymous || !guestName ? 'Add name' : 'Edit name'}
              </button>
              <button
                onClick={handleShare}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white sm:w-auto"
                style={{ backgroundColor: themeSecondary, color: secondaryText }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {luckyDrawEnabled && (
          <section
            id="lucky-draw"
            className="mb-8 rounded-2xl border p-6 shadow-sm sm:p-8 scroll-mt-24"
            style={{ backgroundColor: themeSurface, borderColor: themePrimary, color: surfaceText }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2" style={{ color: themeSecondary }}>
                  <Trophy className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Lucky Draw</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold" style={{ color: surfaceText }}>
                  Your Entry Numbers
                </h2>
                <p className="mt-2 text-sm" style={{ color: surfaceMuted }}>
                  Join the lucky draw when you upload a photo to get your entry number.
                </p>
              </div>
              <div
                className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: themeSecondary, color: secondaryText }}
              >
                <Trophy className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6">
              {luckyDrawNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {luckyDrawNumbers.map((number, index) => (
                    <motion.span
                      key={`${number}-${index}`}
                      custom={index}
                      variants={luckyNumberVariants}
                      initial="hidden"
                      animate="visible"
                      className="rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1"
                      style={{
                        backgroundColor: themeSecondary,
                        color: secondaryText,
                        borderColor: surfaceBorder,
                      }}
                    >
                      #{number}
                    </motion.span>
                  ))}
                </div>
              ) : hasJoinedDraw ? (
                <div
                  className="rounded-lg border p-4 text-sm"
                  style={{ backgroundColor: themeSurface, borderColor: surfaceBorder, color: surfaceMuted }}
                >
                  You are in the draw. Your lucky draw number will appear shortly.
                </div>
              ) : (
                <div
                  className="rounded-lg border p-4 text-sm"
                  style={{ backgroundColor: themeSurface, borderColor: surfaceBorder, color: surfaceMuted }}
                >
                  Join the lucky draw when you upload your photo to get your entry number.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Event Details Card */}
        <div
          className="mb-8 rounded-2xl border p-6 shadow-sm sm:p-8"
          style={{ backgroundColor: themeSurface, borderColor: themePrimary, color: surfaceText }}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-1 h-5 w-5 flex-shrink-0" style={{ color: themeSecondary }} />
              <div>
                <p className="text-xs font-medium" style={{ color: surfaceMuted }}>Date</p>
                <p className="text-sm font-semibold" style={{ color: surfaceText }}>{formattedDate}</p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 flex-shrink-0" style={{ color: themeSecondary }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: surfaceMuted }}>Location</p>
                  <p className="text-sm font-semibold" style={{ color: surfaceText }}>{event.location}</p>
                </div>
              </div>
            )}

            {event.expected_guests && (
              <div className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 flex-shrink-0" style={{ color: themeSecondary }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: surfaceMuted }}>Guests</p>
                  <p className="text-sm font-semibold" style={{ color: surfaceText }}>{event.expected_guests}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <ImageIcon className="mt-1 h-5 w-5 flex-shrink-0" style={{ color: themeSecondary }} />
              <div>
                <p className="text-xs font-medium" style={{ color: surfaceMuted }}>Photos</p>
                <p className="text-sm font-semibold" style={{ color: surfaceText }}>{mergedPhotos.length}</p>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: themePrimary }}>
              <p className="text-sm" style={{ color: surfaceMuted }}>{event.description}</p>
            </div>
          )}
        </div>

        {/* Upload CTA */}
        {moderationNotice && (
          <div
            className={clsx(
              'mb-6 rounded-lg px-4 py-3 text-sm font-medium',
              moderationNoticeType === 'approved'
                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
            )}
          >
            {moderationNotice}
          </div>
        )}
        <div className="mb-8">
          <button
            onClick={() => {
              setShowUploadModal(true);
              setRecaptchaToken(null);
              setRecaptchaError(null);
            }}
            className="w-full rounded-2xl border-2 border-dashed p-8 text-center transition-colors"
            style={{ backgroundColor: themeSurface, borderColor: themePrimary, color: surfaceText }}
          >
            <Upload className="mx-auto mb-3 h-10 w-10" style={{ color: themeSecondary }} />
            <h3 className="text-lg font-semibold" style={{ color: surfaceText }}>
              Share Your Photos
            </h3>
            <p className="mt-1 text-sm" style={{ color: surfaceMuted }}>
              Upload your favorite moments from this event
            </p>
          </button>
        </div>

        {/* Photo Gallery */}
        <div>
          <h2 className="mb-4 text-xl font-semibold" style={{ color: surfaceText }}>
            Event Photos
          </h2>
          {mergedPhotos.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-12 text-center"
              style={{ backgroundColor: themeSurface, borderColor: surfaceBorder }}
            >
              <ImageIcon className="mx-auto mb-4 h-16 w-16" style={{ color: surfaceMuted }} />
              <p style={{ color: surfaceText }}>No photos yet</p>
              <p className="mt-1 text-sm" style={{ color: surfaceMuted }}>
                Be the first to share a moment!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {mergedPhotos.map((photo, index) => {
                  const userLoveCount = userLoves[photo.id] || 0;
                  const totalHeartCount = photo.reactions?.heart || 0;

                  return (
                    <motion.div
                      key={photo.id}
                      custom={index}
                      variants={photoCardVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover="hover"
                      whileTap="tap"
                      onDoubleClick={() => {
                        if (photo.status !== 'approved') return;
                        handleLoveReaction(photo.id);
                      }}
                      className={clsx(
                        'group relative aspect-square overflow-hidden cursor-pointer',
                        PHOTO_CARD_STYLE_CLASSES[photoCardStyle] || PHOTO_CARD_STYLE_CLASSES.vacation,
                        canDownload && selectedPhotoIds.has(photo.id) && 'ring-2 ring-violet-500'
                      )}
                    >
                      <Image
                        src={photo.images.medium_url || photo.images.full_url}
                        alt={photo.caption || 'Event photo'}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                        className="object-cover"
                      />

                      {/* Download button */}
                      {canDownload && photo.status === 'approved' && (
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

                      {/* Select checkbox */}
                      {canDownload && photo.status === 'approved' && (
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPhotoIds.has(photo.id)}
                            onChange={() => toggleSelectedPhoto(photo.id)}
                            className="h-4 w-4 rounded border-white text-violet-600 focus:ring-violet-500"
                          />
                        </label>
                      )}

                      {(photo.status === 'pending' || photo.status === 'rejected') && (
                        <div className={clsx(
                          'absolute inset-0 z-10 flex items-center justify-center text-center text-xs font-semibold uppercase tracking-wide',
                          photo.status === 'pending'
                            ? 'bg-black/55 text-yellow-100'
                            : 'bg-black/70 text-red-100'
                        )}>
                          <span className="rounded-full bg-black/40 px-3 py-1">
                            {photo.status === 'pending' ? 'Pending approval' : 'Rejected'}
                          </span>
                        </div>
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
                          {/* Central heart */}
                          <motion.div
                            variants={heartBurstVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex items-center justify-center"
                          >
                            <Heart className="h-20 w-20 fill-pink-500 text-pink-500 drop-shadow-lg" />
                          </motion.div>
                          {/* Particle hearts */}
                          {createParticleBurst(8).map((angle, i) => (
                            <motion.div
                              key={i}
                              className="absolute top-1/2 left-1/2"
                              style={{ marginLeft: -12, marginTop: -12 }}
                              {...heartParticleVariants(angle, 50)}
                            >
                              <Heart className="h-6 w-6 fill-pink-400 text-pink-400 drop-shadow-md" />
                            </motion.div>
                          ))}
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
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-center">
                {hasMoreApproved && (
                  isLoadingMore ? (
                    <div
                      className="flex items-center gap-2 text-sm"
                      style={{ color: 'rgb(71, 85, 105)' }}
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading more photos...
                    </div>
                  ) : (
                    <button
                      onClick={loadMoreApproved}
                      className="rounded-full border px-4 py-2 text-sm font-medium hover:opacity-80"
                      style={{ borderColor: surfaceBorder, color: surfaceText, backgroundColor: inputBackground }}
                    >
                      Load 5 more
                    </button>
                  )
                )}
              </div>
              <div ref={loadMoreRef} className="h-1" />
            </>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            >
              <motion.div
                variants={modalContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-md rounded-2xl p-6 shadow-xl"
                style={{ backgroundColor: themeSurface, color: surfaceText, borderColor: surfaceBorder }}
              >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: surfaceText }}>
                Share Event
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="hover:opacity-80"
                style={{ color: surfaceMuted }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm" style={{ color: surfaceMuted }}>
              Share this link with guests to let them view and upload photos:
            </p>
            <div
              className="mb-4 flex items-center gap-2 rounded-lg border p-3"
              style={{ borderColor: surfaceBorder, backgroundColor: inputBackground }}
            >
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: surfaceText }}
              />
              <button
                onClick={copyToClipboard}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                Copy Link
              </button>
            </div>
            </motion.div>
          </motion.div>
        </>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <>
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            >
              <motion.div
                variants={modalContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
                style={{ backgroundColor: themeSurface, color: surfaceText, borderColor: surfaceBorder }}
              >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: surfaceText }}>
                Upload Photo
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setUploadError(null);
                  setUploadSuccess(false);
                  setUploadSuccessMessage('Photo uploaded successfully!');
                  setCaption('');
                  setOptimizedCount(0);
                  setRecaptchaToken(null);
                  setRecaptchaError(null);
                }}
                className="hover:opacity-80"
                style={{ color: surfaceMuted }}
                disabled={isUploading || isOptimizing}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success Message */}
            {uploadSuccess && (
              <div className="mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium" style={{ color: surfaceText }}>
                  {uploadSuccessMessage}
                  {optimizedCount > 0 && (
                    <span className="ml-2 text-xs" style={{ color: surfaceMuted }}>
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
              <div
                className="mb-4 flex flex-col items-center gap-3 rounded-lg p-6"
                style={{ backgroundColor: inputBackground }}
              >
                <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeSecondary }} />
                <p className="text-sm font-medium text-gray-900">
                  Uploading photos...
                </p>
              </div>
            )}

            {isOptimizing && (
              <div
                className="mb-4 flex flex-col items-center gap-3 rounded-lg p-6"
                style={{ backgroundColor: inputBackground }}
              >
                <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeSecondary }} />
                <p className="text-sm font-medium text-gray-900">
                  Optimizing large photos...
                </p>
              </div>
            )}

            {!uploadSuccess && !isUploading && !isOptimizing && (
              <div className="space-y-4">
                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium" style={{ color: surfaceText }}>
                      Selected Photos ({selectedFiles.length}/5)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <AnimatePresence>
                        {selectedFiles.map((file, index) => (
                          <motion.div
                            key={index}
                            variants={fileCardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            custom={index}
                            className="relative aspect-square rounded-lg overflow-hidden"
                            style={{ backgroundColor: inputBackground }}
                        >
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
                        </motion.div>
                      ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* File Selection Buttons */}
                {selectedFiles.length < 5 && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Camera Button */}
                    <label
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all hover:opacity-90"
                      style={{ borderColor: themePrimary, backgroundColor: inputBackground }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                      />
                      <Camera className="h-8 w-8" style={{ color: themeSecondary }} />
                      <span className="text-xs font-semibold" style={{ color: surfaceText }}>
                        Camera
                      </span>
                    </label>

                    {/* Gallery Button */}
                    <label
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all hover:opacity-90"
                      style={{ borderColor: themePrimary, backgroundColor: inputBackground }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                      />
                      <ImageIcon className="h-8 w-8" style={{ color: themeSecondary }} />
                      <span className="text-xs font-semibold" style={{ color: surfaceText }}>
                        Gallery
                      </span>
                    </label>
                  </div>
                )}

                <p className="text-xs text-center" style={{ color: surfaceMuted }}>
                  Large photos are optimized automatically before upload
                </p>

                {/* Caption */}
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: surfaceText }}>
                    Caption (optional)
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    className="w-full rounded-lg border px-4 py-2.5 text-sm focus:border-violet-500 focus:ring-violet-500"
                    style={{ backgroundColor: inputBackground, borderColor: inputBorder, color: surfaceText }}
                    maxLength={200}
                  />
                </div>

                {/* Lucky Draw Entry */}
                {luckyDrawEnabled && !isAnonymous && (
                  <div
                    className="rounded-lg border p-4"
                    style={{ borderColor: surfaceBorder, backgroundColor: inputBackground }}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={joinLuckyDraw}
                        onChange={(e) => setJoinLuckyDraw(e.target.checked)}
                        disabled={hasJoinedDraw || hasActiveLuckyDrawConfig === false}
                        className="mt-0.5 h-4 w-4 rounded text-violet-600 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderColor: inputBorder }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          <span className="text-sm font-medium" style={{ color: surfaceText }}>
                            Join Lucky Draw
                          </span>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: surfaceMuted }}>
                          Enter this photo into the lucky draw for a chance to win prizes!
                        </p>
                        {hasActiveLuckyDrawConfig === false && (
                          <p className="mt-1 text-xs" style={{ color: '#F59E0B' }}>
                            Lucky draw is not configured yet.
                          </p>
                        )}
                        {hasJoinedDraw && (
                          <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            ✓ You have already joined the lucky draw
                          </p>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {/* Photo Challenge Progress Bar */}
                {photoChallenge?.enabled && (
                  <PhotoChallengeProgressBar
                    challenge={photoChallenge}
                    progress={challengeProgress}
                    themePrimary={themePrimary}
                    themeSecondary={themeSecondary}
                    surfaceText={surfaceText}
                    surfaceMuted={surfaceMuted}
                    surfaceBorder={surfaceBorder}
                    inputBackground={inputBackground}
                  />
                )}

                {allowAnonymous && isAnonymous && (
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      ⚠️ Anonymous users cannot participate in the lucky draw
                    </p>
                  </div>
                )}

                {(isAnonymous || !guestName.trim()) && (
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: surfaceBorder, backgroundColor: inputBackground }}
                  >
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
                    className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ backgroundColor: themeSecondary, color: secondaryText }}
                  >
                    Upload {selectedFiles.length} Photo{selectedFiles.length > 1 ? 's' : ''}
                  </button>
                )}

                {/* Photos Remaining Info */}
                {(() => {
                  const userLimit = event?.settings?.limits?.max_photos_per_user;
                  const userPhotos = mergedPhotos.filter(photo => photo.user_fingerprint === `guest_${fingerprint}`).length;
                  const remaining = userLimit === null || userLimit === undefined
                    ? `${userPhotos} uploaded`
                    : Math.max(0, userLimit - userPhotos);

                  return (
                    <p className="text-xs text-center" style={{ color: surfaceMuted }}>
                      {typeof remaining === 'string'
                        ? `${remaining}`
                        : `${remaining} photo${userPhotos === 1 && typeof remaining !== 'string' && remaining > 1 ? '' : 's'} remaining`}
                    </p>
                  );
                })()}
              </div>
            )}
            </motion.div>
          </motion.div>
        </>
        )}
      </AnimatePresence>

      {/* Floating Camera Button */}
      {event?.settings?.features?.photo_upload_enabled !== false && (
        <motion.button
          onClick={() => {
            setShowUploadModal(true);
            setRecaptchaToken(null);
            setRecaptchaError(null);
          }}
          animate="idle"
          whileHover="hover"
          whileTap="tap"
          variants={floatingButtonVariants}
          className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-2xl"
          style={{ backgroundImage: `linear-gradient(135deg, ${themePrimary}, ${themeSecondary})` }}
          aria-label="Quick photo upload"
        >
          <Camera className="h-8 w-8" />
        </motion.button>
      )}

      {/* Check-in Button */}
      {attendanceEnabled && !hasCheckedIn && (
        <motion.button
          onClick={() => setShowCheckInModal(true)}
          animate="idle"
          whileHover="hover"
          whileTap="tap"
          variants={floatingButtonVariants}
          className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 md:bottom-6 md:left-6"
          aria-label="Check in"
        >
          <UserCheck className="h-5 w-5" />
          <span>Check In</span>
        </motion.button>
      )}

      {/* Checked-in Badge */}
      {attendanceEnabled && hasCheckedIn && (
        <div className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-3 text-sm font-semibold text-emerald-800 shadow-lg md:bottom-6 md:left-6 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Check className="h-5 w-5" />
          <span>Checked In</span>
        </div>
      )}

      {/* Check-in Modal */}
      <AnimatePresence>
        {showCheckInModal && (
          <CheckInModal
            eventId={resolvedEventId || ''}
            onClose={() => setShowCheckInModal(false)}
            onSuccess={() => {
              setHasCheckedIn(true);
              setShowCheckInModal(false);
              // Mark user as non-anonymous after check-in so progress bar shows
              setIsAnonymous(false);
              // Store the check-in status in localStorage for persistence
              if (typeof window !== 'undefined') {
                localStorage.setItem(`event_${resolvedEventId}_checked_in`, 'true');
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Photo Challenge Prize Modal */}
      <AnimatePresence>
        {showPrizeModal && photoChallenge && challengeProgress && resolvedEventId && (
          <PhotoChallengePrizeModal
            isOpen={showPrizeModal}
            onClose={() => setShowPrizeModal(false)}
            challenge={photoChallenge}
            progress={challengeProgress}
            eventId={resolvedEventId}
            tenantId={event?.tenant_id}
            themePrimary={themePrimary}
            themeSecondary={themeSecondary}
            themeSurface={themeSurface}
            surfaceText={surfaceText}
            surfaceMuted={surfaceMuted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
