// ============================================
// Galeria - Guest Event Page Controller Hook
// ============================================

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { IEvent, IPhoto, IPhotoChallenge, IGuestPhotoProgress } from '@/lib/types';
import { getClientFingerprint } from '@/lib/fingerprint';
import { useLuckyDraw, usePhotoGallery } from '@/lib/realtime/client';
import { useGuestTheme } from './useGuestTheme';
import {
  formatEntryNumbers,
  mergePhotos,
  resizeImageIfNeeded,
} from '../_lib/guest-utils';

// ============================================
// TYPES
// ============================================

export interface SelectedFile {
  file: File;
  preview: string;
  name: string;
}

const GUEST_MAX_DIMENSION = 4000;
const PHOTO_PAGE_SIZE = 5;

export function useGuestEventPageController(eventId: string) {

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
  const approvedPhotosRef = useRef<IPhoto[]>([]);
  const realtimeReconcileInFlightRef = useRef(false);
  const realtimeReconcileQueuedRef = useRef(false);

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
  const {
    photoCardStyle,
    themePrimary,
    themeSecondary,
    themeBackground,
    themeSurface,
    themeGradient,
    surfaceText,
    surfaceMuted,
    surfaceBorder,
    inputBackground,
    inputBorder,
    headerBackground,
    primaryText,
    secondaryText,
  } = useGuestTheme(event);

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
    approvedPhotosRef.current = approvedPhotos;
  }, [approvedPhotos]);

  const reconcileApprovedPhotos = useCallback(async () => {
    if (!resolvedEventId) return;

    try {
      const headers: Record<string, string> = {};
      if (fingerprint) {
        headers['x-fingerprint'] = fingerprint;
      }

      const response = await fetch(
        `/api/events/${resolvedEventId}/photos?status=approved&limit=${PHOTO_PAGE_SIZE}&offset=0`,
        { headers }
      );
      if (!response.ok) return;

      const data = await response.json();
      const nextApproved = (data.data || []) as IPhoto[];
      const total = data.pagination?.total ?? approvedTotal ?? nextApproved.length;

      const incomingIds = new Set(nextApproved.map((photo) => photo.id));
      const preserved = approvedPhotosRef.current.filter((photo) => !incomingIds.has(photo.id));
      const merged = [...nextApproved, ...preserved];

      setApprovedPhotos(merged);
      setApprovedTotal(total);
      setHasMoreApproved(merged.length < total);
    } catch (err) {
      console.error('[GUEST_EVENT] Realtime approved photo reconcile failed:', err);
    }
  }, [resolvedEventId, fingerprint, approvedTotal]);

  const reconcileModerationStatuses = useCallback(async () => {
    if (!resolvedEventId || !fingerprint || !moderationRequired) return;

    try {
      const headers: Record<string, string> = { 'x-fingerprint': fingerprint };
      const [pendingRes, rejectedRes] = await Promise.all([
        fetch(`/api/events/${resolvedEventId}/photos?status=pending`, { headers }),
        fetch(`/api/events/${resolvedEventId}/photos?status=rejected`, { headers }),
      ]);

      const pendingJson = await pendingRes.json();
      const rejectedJson = await rejectedRes.json();

      if (!pendingRes.ok || !rejectedRes.ok) return;

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
      console.error('[GUEST_EVENT] Realtime moderation reconcile failed:', err);
    }
  }, [resolvedEventId, fingerprint, moderationRequired]);

  const runRealtimeReconcile = useCallback(async () => {
    if (realtimeReconcileInFlightRef.current) {
      realtimeReconcileQueuedRef.current = true;
      return;
    }

    realtimeReconcileInFlightRef.current = true;
    try {
      await Promise.all([
        reconcileApprovedPhotos(),
        reconcileModerationStatuses(),
      ]);
    } finally {
      realtimeReconcileInFlightRef.current = false;
      if (realtimeReconcileQueuedRef.current) {
        realtimeReconcileQueuedRef.current = false;
        setTimeout(() => {
          void runRealtimeReconcile();
        }, 0);
      }
    }
  }, [reconcileApprovedPhotos, reconcileModerationStatuses]);

  usePhotoGallery(resolvedEventId || '', {
    onNewPhoto: (photo) => {
      if (photo.status !== 'approved') return;
      setApprovedPhotos((prev) => {
        if (prev.some((item) => item.id === photo.id)) {
          return prev;
        }
        return [photo, ...prev];
      });
      setApprovedTotal((prev) => (prev === null ? prev : prev + 1));
    },
    onPhotoUpdated: () => {
      void runRealtimeReconcile();
    },
    onReactionAdded: ({ photo_id, count }) => {
      updatePhotoById(photo_id, (photo) => ({
        ...photo,
        reactions: {
          ...photo.reactions,
          heart: count,
        },
      }));
    },
  });

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
    const pollStatuses = async () => {
      if (isCancelled) return;
      await reconcileModerationStatuses();
    };

    void pollStatuses();
    const interval = setInterval(pollStatuses, 15000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [resolvedEventId, fingerprint, moderationRequired, reconcileModerationStatuses]);

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
          text: event?.description || `Join ${event?.name} on Galeria!`,
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

  return {
    resolvedEventId,
    event,
    approvedPhotos,
    pendingPhotos,
    rejectedPhotos,
    approvedTotal,
    isLoadingMore,
    hasMoreApproved,
    isLoading,
    isResolving,
    error,
    showShareModal,
    showUploadModal,
    showCheckInModal,
    hasCheckedIn,
    isUploading,
    isOptimizing,
    uploadError,
    uploadSuccess,
    uploadSuccessMessage,
    optimizedCount,
    moderationNotice,
    moderationNoticeType,
    joinLuckyDraw,
    hasJoinedDraw,
    luckyDrawNumbers,
    hasActiveLuckyDrawConfig,
    photoChallenge,
    challengeProgress,
    showPrizeModal,
    fingerprint,
    recaptchaToken,
    recaptchaError,
    winner,
    isDrawing,
    showDrawOverlay,
    showWinnerOverlay,
    mergedPhotos,
    guestName,
    isAnonymous,
    showGuestModal,
    allowAnonymous,
    moderationRequired,
    luckyDrawEnabled,
    attendanceEnabled,
    photoCardStyle,
    themePrimary,
    themeSecondary,
    themeBackground,
    themeSurface,
    themeGradient,
    surfaceText,
    surfaceMuted,
    surfaceBorder,
    inputBackground,
    inputBorder,
    headerBackground,
    primaryText,
    secondaryText,
    selectedFiles,
    caption,
    userLoves,
    animatingPhotos,
    selectedPhotoIds,
    canDownload,
    selectedCount,
    loadMoreRef,
    handleGuestModalSubmit,
    setShowGuestModal,
    handleLoveReaction,
    handleDownloadPhoto,
    handleDownloadAll,
    handleDownloadSelected,
    handleDownloadSelectedIndividually,
    toggleSelectedPhoto,
    loadMoreApproved,
    setShowShareModal,
    shareUrl,
    handleShare,
    copyToClipboard,
    handleFileSelect,
    removeSelectedFile,
    handleUpload,
    setShowUploadModal,
    setRecaptchaToken,
    setRecaptchaError,
    setCaption,
    setJoinLuckyDraw,
    setSelectedFiles,
    setUploadError,
    setUploadSuccess,
    setUploadSuccessMessage,
    setOptimizedCount,
    setShowCheckInModal,
    setHasCheckedIn,
    setIsAnonymous,
    setShowPrizeModal,
    setShowDrawOverlay,
    setShowWinnerOverlay,
  };
}
