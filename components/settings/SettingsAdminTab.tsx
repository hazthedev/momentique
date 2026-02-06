// ============================================
// Gatherly - Settings Admin Tab Component
// ============================================

'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Palette,
  Sparkles,
  Shield,
  Settings,
  Loader2,
  Check,
  X,
  Eye,
  Users,
  Download,
  Target,
  Hash,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import type { EventType, IEvent } from '@/lib/types';

const PHOTO_CARD_STYLES = [
  { id: 'vacation', label: 'Vacation', description: 'Bright, airy, postcard vibe' },
  { id: 'brutalist', label: 'Brutalist', description: 'Bold borders, raw contrast' },
  { id: 'wedding', label: 'Wedding', description: 'Soft, romantic, refined' },
  { id: 'celebration', label: 'Celebration', description: 'Warm, festive, joyful' },
  { id: 'futuristic', label: 'Futuristic', description: 'Neon glow, sleek tech' },
];

const THEME_PRESETS = [
  {
    id: 'palette-1',
    label: 'Vibrant Travel',
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    background: 'linear-gradient(135deg, #FFE5E5 0%, #FFF5E1 50%, #E0F7F4 100%)',
  },
  {
    id: 'palette-2',
    label: 'Tropical Paradise',
    primary: '#06B6D4',
    secondary: '#10B981',
    background: 'linear-gradient(135deg, #E0F7FA 0%, #E8F5E9 50%, #FFF3E0 100%)',
  },
  {
    id: 'palette-3',
    label: 'Refined Purple',
    primary: '#8B5CF6',
    secondary: '#EC4899',
    background: 'linear-gradient(135deg, #F3E5F5 0%, #FCE4EC 50%, #FFF8E1 100%)',
  },
  {
    id: 'palette-4',
    label: 'Sunset Glow',
    primary: '#F97316',
    secondary: '#DC2626',
    background: 'linear-gradient(135deg, #FFEBEE 0%, #FFF3E0 50%, #FFF9C4 100%)',
  },
  {
    id: 'palette-5',
    label: 'Ocean Breeze',
    primary: '#0EA5E9',
    secondary: '#6366F1',
    background: 'linear-gradient(135deg, #E3F2FD 0%, #EDE7F6 50%, #E0F2F1 100%)',
  },
];

const PHOTO_CARD_STYLE_CLASSES: Record<string, string> = {
  vacation: 'rounded-2xl bg-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5',
  brutalist: 'rounded-none bg-white border-2 border-black shadow-[6px_6px_0_#000]',
  wedding: 'rounded-3xl bg-white border border-rose-200 shadow-[0_8px_24px_rgba(244,114,182,0.25)]',
  celebration: 'rounded-2xl bg-gradient-to-br from-yellow-50 via-white to-pink-50 border border-amber-200 shadow-[0_10px_26px_rgba(249,115,22,0.25)]',
  futuristic: 'rounded-2xl bg-slate-950/90 border border-cyan-400/40 shadow-[0_0_24px_rgba(34,211,238,0.35)]',
};

const DEFAULT_UPLOAD_RATE_LIMITS = {
  per_user_hourly: 1000,
  burst_per_ip_minute: 100,
  per_event_daily: 1000,
};

type SettingsSubTab = 'basic' | 'theme' | 'features' | 'security' | 'advanced';

interface SettingsAdminTabProps {
  event: IEvent;
  onUpdate?: (event: IEvent) => void;
}

export function SettingsAdminTab({ event, onUpdate }: SettingsAdminTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Basic Info state
  const [eventName, setEventName] = useState(event.name);
  const [eventType, setEventType] = useState(event.event_type);
  const [eventDate, setEventDate] = useState(
    new Date(event.event_date).toISOString().split('T')[0]
  );
  const [location, setLocation] = useState(event.location || '');
  const [expectedGuests, setExpectedGuests] = useState(event.expected_guests || 0);
  const [description, setDescription] = useState(event.description || '');
  const [customHashtag, setCustomHashtag] = useState(event.custom_hashtag || '');
  const [shortCode, setShortCode] = useState(event.short_code || '');
  const [eventStatus, setEventStatus] = useState(event.status);

  // Theme state
  const [photoCardStyle, setPhotoCardStyle] = useState(
    event.settings?.theme?.photo_card_style || 'vacation'
  );
  const [primaryColor, setPrimaryColor] = useState(
    event.settings?.theme?.primary_color || '#8B5CF6'
  );
  const [secondaryColor, setSecondaryColor] = useState(
    event.settings?.theme?.secondary_color || '#EC4899'
  );
  const [backgroundColor, setBackgroundColor] = useState(
    event.settings?.theme?.background || '#F9FAFB'
  );
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    // Find which preset matches the current event colors
    const currentPrimary = event.settings?.theme?.primary_color || '#8B5CF6';
    const currentSecondary = event.settings?.theme?.secondary_color || '#EC4899';
    const currentBackground = event.settings?.theme?.background || '#F9FAFB';

    const matchingPreset = THEME_PRESETS.find(preset =>
      preset.primary === currentPrimary &&
      preset.secondary === currentSecondary &&
      preset.background === currentBackground
    );
    return matchingPreset?.id || null;
  });

  // Sync selectedPreset when colors change
  useEffect(() => {
    const matchingPreset = THEME_PRESETS.find(preset =>
      preset.primary === primaryColor &&
      preset.secondary === secondaryColor &&
      preset.background === backgroundColor
    );
    setSelectedPreset(matchingPreset?.id || null);
  }, [primaryColor, secondaryColor, backgroundColor]);

  // Features state
  const [guestDownloadEnabled, setGuestDownloadEnabled] = useState(
    event.settings?.features?.guest_download_enabled !== false
  );
  const [moderationRequired, setModerationRequired] = useState(
    event.settings?.features?.moderation_required || false
  );
  const [anonymousAllowed, setAnonymousAllowed] = useState(
    event.settings?.features?.anonymous_allowed !== false
  );
  const [luckyDrawEnabled, setLuckyDrawEnabled] = useState(
    event.settings?.features?.lucky_draw_enabled !== false
  );
  const [attendanceEnabled, setAttendanceEnabled] = useState(
    event.settings?.features?.attendance_enabled !== false
  );
  const [photoChallengeEnabled, setPhotoChallengeEnabled] = useState(
    event.settings?.features?.photo_challenge_enabled || false
  );

  // Security state
  const [uploadRateLimits, setUploadRateLimits] = useState({
    ...DEFAULT_UPLOAD_RATE_LIMITS,
    ...(event.settings?.security?.upload_rate_limits || {}),
  });

  const subTabs: { id: SettingsSubTab; label: string; icon: LucideIcon }[] = [
    { id: 'basic', label: 'Basic Info', icon: Calendar },
    { id: 'theme', label: 'Theme & Design', icon: Palette },
    { id: 'features', label: 'Features', icon: Sparkles },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  const handleSave = async (section?: SettingsSubTab) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: eventName,
          event_type: eventType,
          event_date: new Date(eventDate).toISOString(),
          location: location || null,
          expected_guests: expectedGuests || null,
          description: description || null,
          custom_hashtag: customHashtag || null,
          short_code: shortCode || null,
          status: eventStatus,
          settings: {
            ...event.settings,
            theme: {
              ...event.settings?.theme,
              photo_card_style: photoCardStyle,
              primary_color: primaryColor,
              secondary_color: secondaryColor,
              background: backgroundColor,
              surface_color: backgroundColor,
            },
            features: {
              ...event.settings?.features,
              guest_download_enabled: guestDownloadEnabled,
              moderation_required: moderationRequired,
              anonymous_allowed: anonymousAllowed,
              lucky_draw_enabled: luckyDrawEnabled,
              attendance_enabled: attendanceEnabled,
              photo_challenge_enabled: photoChallengeEnabled,
            },
            security: {
              upload_rate_limits: {
                ...DEFAULT_UPLOAD_RATE_LIMITS,
                ...uploadRateLimits,
              },
            },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('Settings saved successfully');
      setHasChanges(false);
      if (onUpdate && data.data) {
        onUpdate(data.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                  activeSubTab === tab.id
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

      {/* Basic Info Tab */}
      {activeSubTab === 'basic' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Basic Information
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Edit the basic details of your event
              </p>
            </div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => { setEventName(e.target.value); setHasChanges(true); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="My Awesome Event"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={eventType}
                  onChange={(e) => { setEventType(e.target.value as EventType); setHasChanges(true); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="birthday">Birthday</option>
                  <option value="wedding">Wedding</option>
                  <option value="corporate">Corporate</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => { setEventDate(e.target.value); setHasChanges(true); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setHasChanges(true); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="Venue name or address"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Expected Guests
                </label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={expectedGuests}
                  onChange={(e) => { setExpectedGuests(parseInt(e.target.value) || 0); setHasChanges(true); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="Describe your event..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('basic')}
              disabled={isLoading || !hasChanges}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLoading || !hasChanges ? 'bg-gray-400' : 'bg-violet-600 hover:bg-violet-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Theme & Design Tab */}
      {activeSubTab === 'theme' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Theme & Design
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customize the appearance of your event page
              </p>
            </div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>

          {/* Photo Card Style */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
              Photo Card Style
            </h4>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {PHOTO_CARD_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => { setPhotoCardStyle(style.id); setHasChanges(true); }}
                  className={clsx(
                    'group relative overflow-hidden rounded-lg border-2 p-3 text-left transition-all',
                    photoCardStyle === style.id
                      ? 'border-violet-500 ring-2 ring-violet-200 dark:ring-violet-900'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  )}
                >
                  <div className={clsx('aspect-[3/4] mb-2', PHOTO_CARD_STYLE_CLASSES[style.id])} />
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{style.label}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{style.description}</p>
                  {photoCardStyle === style.id && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
              Color Palette
            </h4>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setPrimaryColor(preset.primary);
                    setSecondaryColor(preset.secondary);
                    setBackgroundColor(preset.background);
                    setSelectedPreset(preset.id);
                    setHasChanges(true);
                  }}
                  className={clsx(
                    'group relative overflow-hidden rounded-lg border-2 p-3 text-left transition-all',
                    selectedPreset === preset.id
                      ? 'border-violet-500 ring-2 ring-violet-200 dark:ring-violet-900'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  )}
                >
                  <div
                    className="h-16 rounded-md mb-2"
                    style={{ background: preset.background }}
                  />
                  <div className="flex items-center gap-1 mb-1">
                    <div
                      className="h-4 w-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div
                      className="h-4 w-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: preset.secondary }}
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{preset.label}</p>
                  {selectedPreset === preset.id && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('theme')}
              disabled={isLoading || !hasChanges}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLoading || !hasChanges ? 'bg-gray-400' : 'bg-violet-600 hover:bg-violet-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Features Tab */}
      {activeSubTab === 'features' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Event Features
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable or disable features for your event
              </p>
            </div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Lucky Draw */}
            <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Lucky Draw
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow guests to enter photos into draws
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={luckyDrawEnabled}
                onChange={(e) => { setLuckyDrawEnabled(e.target.checked); setHasChanges(true); }}
                className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
              />
            </label>

            {/* Attendance */}
            <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Attendance Check-in
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow guests to check in to the event
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={attendanceEnabled}
                onChange={(e) => { setAttendanceEnabled(e.target.checked); setHasChanges(true); }}
                className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
              />
            </label>

            {/* Photo Challenge */}
            <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Photo Challenge
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Motivate guests with photo goals
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={photoChallengeEnabled}
                onChange={(e) => { setPhotoChallengeEnabled(e.target.checked); setHasChanges(true); }}
                className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
              />
            </label>

            {/* Photo Downloads */}
            <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Photo Downloads
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Guests can download photos
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={guestDownloadEnabled}
                onChange={(e) => { setGuestDownloadEnabled(e.target.checked); setHasChanges(true); }}
                className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
              />
            </label>

            {/* Photo Moderation */}
            <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Photo Moderation
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Require approval before showing photos
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={moderationRequired}
                onChange={(e) => { setModerationRequired(e.target.checked); setHasChanges(true); }}
                className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
              />
            </label>

            {/* Anonymous Uploads */}
            <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Anonymous Uploads
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow guests to upload without name
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={anonymousAllowed}
                onChange={(e) => { setAnonymousAllowed(e.target.checked); setHasChanges(true); }}
                className="h-5 w-5 rounded text-violet-600 focus:ring-violet-500"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('features')}
              disabled={isLoading || !hasChanges}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLoading || !hasChanges ? 'bg-gray-400' : 'bg-violet-600 hover:bg-violet-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeSubTab === 'security' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Upload Security Limits
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure rate limits to prevent spam and abuse
              </p>
            </div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Per User
              </label>
              <input
                type="number"
                min="1"
                value={uploadRateLimits.per_user_hourly}
                onChange={(e) => setUploadRateLimits({ ...uploadRateLimits, per_user_hourly: parseInt(e.target.value) || 1 })}
                onBlur={() => setHasChanges(true)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Max uploads per user
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Burst Protection
              </label>
              <input
                type="number"
                min="1"
                value={uploadRateLimits.burst_per_ip_minute}
                onChange={(e) => setUploadRateLimits({ ...uploadRateLimits, burst_per_ip_minute: parseInt(e.target.value) || 1 })}
                onBlur={() => setHasChanges(true)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Max rapid uploads per minute
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Per Event
              </label>
              <input
                type="number"
                min="1"
                value={uploadRateLimits.per_event_daily}
                onChange={(e) => setUploadRateLimits({ ...uploadRateLimits, per_event_daily: parseInt(e.target.value) || 1 })}
                onBlur={() => setHasChanges(true)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Max total uploads
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('security')}
              disabled={isLoading || !hasChanges}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLoading || !hasChanges ? 'bg-gray-400' : 'bg-violet-600 hover:bg-violet-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {activeSubTab === 'advanced' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Advanced Settings
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Additional configuration options
              </p>
            </div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom URL Code
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">/e/</span>
                <input
                  type="text"
                  value={shortCode}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setShortCode(value);
                    setHasChanges(true);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="my-event"
                  maxLength={50}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Lowercase letters, numbers, hyphens only
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Hashtag
              </label>
              <input
                type="text"
                value={customHashtag}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                  setCustomHashtag(value);
                  setHasChanges(true);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="myevent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Letters, numbers, and underscores only
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Event Status
              </label>
              <select
                value={eventStatus}
                onChange={(e) => { setEventStatus(e.target.value as any); setHasChanges(true); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="archived">Archived</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Control event visibility
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleSave('advanced')}
              disabled={isLoading || !hasChanges}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLoading || !hasChanges ? 'bg-gray-400' : 'bg-violet-600 hover:bg-violet-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
