// ============================================
// GATHERLY - Event Settings Form Component
// ============================================
// Theme customization and feature toggles for organizers

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Download, Eye, Sparkles, Palette } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { IEvent, IEventTheme, IEventFeatures } from '@/lib/types';

const PHOTO_CARD_STYLES = [
    { id: 'vacation', label: 'Vacation', description: 'Bright, airy, postcard vibe' },
    { id: 'brutalist', label: 'Brutalist Minimal', description: 'Bold borders, raw contrast' },
    { id: 'wedding', label: 'Wedding', description: 'Soft, romantic, refined' },
    { id: 'celebration', label: 'Celebration', description: 'Warm, festive, joyful' },
    { id: 'futuristic', label: 'Futuristic', description: 'Neon glow, sleek tech' },
];

const PHOTO_CARD_STYLE_CLASSES: Record<string, string> = {
    vacation: 'rounded-2xl bg-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5',
    brutalist: 'rounded-none bg-white border-2 border-black shadow-[6px_6px_0_#000]',
    wedding: 'rounded-3xl bg-white border border-rose-200 shadow-[0_8px_24px_rgba(244,114,182,0.25)]',
    celebration: 'rounded-2xl bg-gradient-to-br from-yellow-50 via-white to-pink-50 border border-amber-200 shadow-[0_10px_26px_rgba(249,115,22,0.25)]',
    futuristic: 'rounded-2xl bg-slate-950/90 border border-cyan-400/40 shadow-[0_0_24px_rgba(34,211,238,0.35)]',
};

// ============================================
// TYPES
// ============================================

interface EventSettingsFormProps {
    event: IEvent;
    onSuccess?: (event: IEvent) => void;
    className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function EventSettingsForm({
    event,
    onSuccess,
    className,
}: EventSettingsFormProps) {
    const [photoCardStyle, setPhotoCardStyle] = useState(
        event.settings?.theme?.photo_card_style || 'vacation'
    );
    const [showPreview, setShowPreview] = useState(false);

    // Feature toggles
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

    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Track changes
    useEffect(() => {
        const originalFeatures = event.settings?.features || {};
        const originalTheme = event.settings?.theme || {};

        const featuresChanged =
            guestDownloadEnabled !== (originalFeatures.guest_download_enabled !== false) ||
            moderationRequired !== (originalFeatures.moderation_required || false) ||
            anonymousAllowed !== (originalFeatures.anonymous_allowed !== false) ||
            luckyDrawEnabled !== (originalFeatures.lucky_draw_enabled !== false);

        const themeChanged = photoCardStyle !== (originalTheme.photo_card_style || 'vacation');

        setHasChanges(featuresChanged || themeChanged);
    }, [guestDownloadEnabled, moderationRequired, anonymousAllowed, luckyDrawEnabled, photoCardStyle, event]);

    // Save settings
    const handleSave = async () => {
        setIsLoading(true);

        try {
            const response = await fetch(`/api/events/${event.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    settings: {
                        ...event.settings,
                        theme: {
                            ...event.settings?.theme,
                            photo_card_style: photoCardStyle,
                        },
                        features: {
                            ...event.settings?.features,
                            guest_download_enabled: guestDownloadEnabled,
                            moderation_required: moderationRequired,
                            anonymous_allowed: anonymousAllowed,
                            lucky_draw_enabled: luckyDrawEnabled,
                        },
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save settings');
            }

            toast.success('Settings saved successfully!');
            setHasChanges(false);
            onSuccess?.(data.data);
        } catch (error) {
            console.error('[EVENT_SETTINGS] Error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save settings');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={clsx('space-y-8', className)}>
            {/* Photo Card Style */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Palette className="h-5 w-5 text-violet-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Photo Card Style
                    </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {PHOTO_CARD_STYLES.map((style) => {
                        const selected = photoCardStyle === style.id;
                        return (
                            <button
                                key={style.id}
                                type="button"
                                onClick={() => setPhotoCardStyle(style.id)}
                                className={clsx(
                                    'group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                                    selected
                                        ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-900/20'
                                        : 'border-gray-200 bg-white hover:border-violet-300 dark:border-gray-700 dark:bg-gray-800'
                                )}
                            >
                                <div className={clsx(
                                    'flex h-16 w-16 items-center justify-center overflow-hidden',
                                    PHOTO_CARD_STYLE_CLASSES[style.id]
                                )}>
                                    <div className="h-12 w-12 rounded-md bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {style.label}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {style.description}
                                    </p>
                                </div>
                                {selected && (
                                    <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                        Active
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Applied to guest photo cards on the event page.
                    </p>
                    <button
                        type="button"
                        onClick={() => setShowPreview(true)}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                    >
                        Preview selected style
                    </button>
                </div>
            </div>

            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Photo Card Preview
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowPreview(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className={clsx(
                                'w-64 max-w-full overflow-hidden',
                                PHOTO_CARD_STYLE_CLASSES[photoCardStyle]
                            )}>
                                <div className="relative aspect-square w-full overflow-hidden rounded-[inherit]">
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700" />
                                    <div
                                        className={clsx(
                                            'absolute inset-0 flex items-center justify-center text-sm font-semibold',
                                            photoCardStyle === 'futuristic'
                                                ? 'text-cyan-100'
                                                : 'text-gray-700 dark:text-gray-200'
                                        )}
                                    >
                                        Preview Photo
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {PHOTO_CARD_STYLES.find((style) => style.id === photoCardStyle)?.description}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Feature Toggles Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-5 w-5 text-violet-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Guest Features
                    </h3>
                </div>

                <div className="space-y-4">
                    {/* Lucky Draw Toggle */}
                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
                        <div className="flex items-center gap-3">
                            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    Enable Lucky Draw
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Allow guests to enter photos into the lucky draw
                                </p>
                            </div>
                        </div>
                        <div
                            onClick={() => setLuckyDrawEnabled(!luckyDrawEnabled)}
                            className={clsx(
                                'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                                luckyDrawEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'
                            )}
                        >
                            <div
                                className={clsx(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform',
                                    luckyDrawEnabled ? 'left-[22px]' : 'left-0.5'
                                )}
                            />
                        </div>
                    </label>

                    {/* Guest Download Toggle */}
                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
                        <div className="flex items-center gap-3">
                            <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    Allow Photo Downloads
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Guests can download photos from the gallery
                                </p>
                            </div>
                        </div>
                        <div
                            onClick={() => setGuestDownloadEnabled(!guestDownloadEnabled)}
                            className={clsx(
                                'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                                guestDownloadEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'
                            )}
                        >
                            <div
                                className={clsx(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform',
                                    guestDownloadEnabled ? 'left-[22px]' : 'left-0.5'
                                )}
                            />
                        </div>
                    </label>

                    {/* Moderation Toggle */}
                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
                        <div className="flex items-center gap-3">
                            <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    Require Photo Moderation
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Photos need approval before appearing in gallery
                                </p>
                            </div>
                        </div>
                        <div
                            onClick={() => setModerationRequired(!moderationRequired)}
                            className={clsx(
                                'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                                moderationRequired ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'
                            )}
                        >
                            <div
                                className={clsx(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform',
                                    moderationRequired ? 'left-[22px]' : 'left-0.5'
                                )}
                            />
                        </div>
                    </label>

                    {/* Anonymous Toggle */}
                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-violet-500 transition-colors">
                        <div className="flex items-center gap-3">
                            <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    Allow Anonymous Uploads
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Guests can upload without sharing their name
                                </p>
                            </div>
                        </div>
                        <div
                            onClick={() => setAnonymousAllowed(!anonymousAllowed)}
                            className={clsx(
                                'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                                anonymousAllowed ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'
                            )}
                        >
                            <div
                                className={clsx(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform',
                                    anonymousAllowed ? 'left-[22px]' : 'left-0.5'
                                )}
                            />
                        </div>
                    </label>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={handleSave}
                    disabled={isLoading || !hasChanges}
                    className={clsx(
                        'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all',
                        hasChanges
                            ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-700 hover:to-pink-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                    )}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save Settings'
                    )}
                </button>
            </div>
        </div>
    );
}

export default EventSettingsForm;
