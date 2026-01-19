// ============================================
// GATHERLY - Event Settings Form Component
// ============================================
// Theme customization and feature toggles for organizers

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Palette, Download, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { IEvent, IEventTheme, IEventFeatures } from '@/lib/types';

// ============================================
// TYPES
// ============================================

interface EventSettingsFormProps {
    event: IEvent;
    onSuccess?: (event: IEvent) => void;
    className?: string;
}

// ============================================
// HELPER: Generate complementary secondary color
// ============================================

function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateSecondaryColor(primary: string): string {
    const { h, s, l } = hexToHSL(primary);
    // Shift hue by 30 degrees (analogous color) and adjust lightness
    const newH = (h + 30) % 360;
    const newL = l > 50 ? l - 15 : l + 15;
    return hslToHex(newH, s, Math.max(20, Math.min(80, newL)));
}

function generateBackgroundColor(primary: string): string {
    const { h, s } = hexToHSL(primary);
    // Pastel with visible color - similar to #c995fe
    return hslToHex(h, Math.max(s * 0.7, 60), 80);
}

// ============================================
// PRESET THEMES
// ============================================

const presetThemes = [
    { name: 'Violet Dream', primary: '#7c3aed', secondary: '#ec4899', background: '#c9a5f7' },
    { name: 'Ocean Blue', primary: '#0ea5e9', secondary: '#06b6d4', background: '#7dd3fc' },
    { name: 'Forest Green', primary: '#22c55e', secondary: '#84cc16', background: '#86efac' },
    { name: 'Sunset Orange', primary: '#f97316', secondary: '#eab308', background: '#fdba74' },
    { name: 'Rose Gold', primary: '#f43f5e', secondary: '#fb7185', background: '#fda4af' },
    { name: 'Midnight', primary: '#6366f1', secondary: '#8b5cf6', background: '#a5b4fc' },
];

// ============================================
// COMPONENT
// ============================================

export function EventSettingsForm({
    event,
    onSuccess,
    className,
}: EventSettingsFormProps) {
    // Theme settings
    const [primaryColor, setPrimaryColor] = useState(event.settings?.theme?.primary_color || '#7c3aed');
    const [secondaryColor, setSecondaryColor] = useState(event.settings?.theme?.secondary_color || '#ec4899');
    const [backgroundColor, setBackgroundColor] = useState(event.settings?.theme?.background || '#f9fafb');

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

    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Track changes
    useEffect(() => {
        const originalTheme = event.settings?.theme || {};
        const originalFeatures = event.settings?.features || {};

        const themeChanged =
            primaryColor !== (originalTheme.primary_color || '#7c3aed') ||
            secondaryColor !== (originalTheme.secondary_color || '#ec4899') ||
            backgroundColor !== (originalTheme.background || '#f9fafb');

        const featuresChanged =
            guestDownloadEnabled !== (originalFeatures.guest_download_enabled !== false) ||
            moderationRequired !== (originalFeatures.moderation_required || false) ||
            anonymousAllowed !== (originalFeatures.anonymous_allowed !== false);

        setHasChanges(themeChanged || featuresChanged);
    }, [primaryColor, secondaryColor, backgroundColor, guestDownloadEnabled, moderationRequired, anonymousAllowed, event]);

    // Auto-suggest secondary color when primary changes
    const handlePrimaryColorChange = useCallback((color: string) => {
        setPrimaryColor(color);
        // Auto-suggest secondary based on primary
        const suggested = generateSecondaryColor(color);
        setSecondaryColor(suggested);
        // Also suggest a matching background
        const suggestedBg = generateBackgroundColor(color);
        setBackgroundColor(suggestedBg);
    }, []);

    // Apply preset theme
    const applyPreset = (preset: typeof presetThemes[0]) => {
        setPrimaryColor(preset.primary);
        setSecondaryColor(preset.secondary);
        setBackgroundColor(preset.background);
    };

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
                            primary_color: primaryColor,
                            secondary_color: secondaryColor,
                            background: backgroundColor,
                        },
                        features: {
                            ...event.settings?.features,
                            guest_download_enabled: guestDownloadEnabled,
                            moderation_required: moderationRequired,
                            anonymous_allowed: anonymousAllowed,
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
            {/* Theme Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Palette className="h-5 w-5 text-violet-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Theme Colors
                    </h3>
                </div>

                {/* Preset Themes */}
                <div className="mb-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Quick Presets</p>
                    <div className="flex flex-wrap gap-2">
                        {presetThemes.map((preset) => (
                            <button
                                key={preset.name}
                                onClick={() => applyPreset(preset)}
                                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-violet-400 hover:bg-violet-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-violet-500 transition-colors"
                            >
                                <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: preset.primary }}
                                />
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Pickers */}
                <div className="space-y-4">
                    {/* Primary Color */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Primary Color
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => handlePrimaryColorChange(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div
                                    className="h-10 w-10 rounded-lg border-2 border-gray-300 dark:border-gray-500 shadow-sm"
                                    style={{ backgroundColor: primaryColor }}
                                />
                            </div>
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => handlePrimaryColorChange(e.target.value)}
                                placeholder="#7c3aed"
                                className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                    </div>

                    {/* Secondary Color */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Secondary Color
                            <span className="text-xs text-violet-500 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Auto
                            </span>
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div
                                    className="h-10 w-10 rounded-lg border-2 border-gray-300 dark:border-gray-500 shadow-sm"
                                    style={{ backgroundColor: secondaryColor }}
                                />
                            </div>
                            <input
                                type="text"
                                value={secondaryColor}
                                onChange={(e) => setSecondaryColor(e.target.value)}
                                placeholder="#ec4899"
                                className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                    </div>

                    {/* Background Color */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Background Color
                            <span className="text-xs text-violet-500 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Auto
                            </span>
                        </label>
                        <div className="flex items-center gap-2 sm:ml-auto">
                            <div className="relative">
                                <input
                                    type="color"
                                    value={backgroundColor}
                                    onChange={(e) => setBackgroundColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div
                                    className="h-10 w-10 rounded-lg border-2 border-gray-300 dark:border-gray-500 shadow-sm"
                                    style={{ backgroundColor: backgroundColor }}
                                />
                            </div>
                            <input
                                type="text"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                placeholder="#f9fafb"
                                className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview</p>
                    <div
                        className="rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                        style={{ backgroundColor }}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="rounded-lg px-4 py-2 text-white text-sm font-medium"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Primary Button
                            </div>
                            <div
                                className="rounded-lg px-4 py-2 text-white text-sm font-medium"
                                style={{ backgroundColor: secondaryColor }}
                            >
                                Secondary
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Toggles Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-5 w-5 text-violet-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Guest Features
                    </h3>
                </div>

                <div className="space-y-4">
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
