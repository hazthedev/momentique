'use client';

// ============================================
// GALERIA - Upgrade Prompt Component
// ============================================
// Shows upgrade prompts when users hit tier limits

import { useState } from 'react';

interface UpgradePromptProps {
    title?: string;
    message: string;
    currentTier?: string;
    recommendedTier?: string;
    featureBlocked?: string;
    onClose?: () => void;
    variant?: 'modal' | 'banner' | 'inline';
}

const TIER_BENEFITS = {
    pro: [
        'Up to 10 events per month',
        '500 photos per event',
        'Lucky draw feature',
        'Remove "Powered by Galeria" branding',
        'Advanced analytics',
    ],
    premium: [
        'Up to 50 events per month',
        '2,000 photos per event',
        'Video uploads',
        'API access',
        'Priority support',
    ],
};

export function UpgradePrompt({
    title = 'Upgrade to unlock this feature',
    message,
    currentTier = 'free',
    recommendedTier = 'pro',
    featureBlocked,
    onClose,
    variant = 'modal',
}: UpgradePromptProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    const handleClose = () => {
        setIsVisible(false);
        onClose?.();
    };

    const benefits = TIER_BENEFITS[recommendedTier as keyof typeof TIER_BENEFITS] || TIER_BENEFITS.pro;

    if (variant === 'banner') {
        return (
            <div className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-4 py-3 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">✨</span>
                        <div>
                            <p className="font-medium">{message}</p>
                            <p className="text-sm opacity-90">
                                Upgrade to {recommendedTier.charAt(0).toUpperCase() + recommendedTier.slice(1)} for more features
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href="/organizer/billing"
                            className="bg-white text-violet-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                        >
                            Upgrade Now
                        </a>
                        {onClose && (
                            <button
                                onClick={handleClose}
                                className="text-white/80 hover:text-white p-1"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <div className="border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">🔒</span>
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{message}</p>
                        <a
                            href="/organizer/billing"
                            className="inline-block mt-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
                        >
                            View upgrade options →
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Modal variant (default)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-violet-600 to-pink-600 p-6 text-white">
                    <div className="text-4xl mb-3">✨</div>
                    <h3 className="text-xl font-bold">{title}</h3>
                    {featureBlocked && (
                        <p className="text-violet-100 mt-1 text-sm">
                            {featureBlocked} requires an upgrade
                        </p>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            {recommendedTier.charAt(0).toUpperCase() + recommendedTier.slice(1)} includes:
                        </p>
                        <ul className="space-y-2">
                            {benefits.map((benefit, index) => (
                                <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                    <span className="text-green-500">✓</span>
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <a
                            href="/organizer/billing"
                            className="flex-1 bg-gradient-to-r from-violet-600 to-pink-600 text-white px-4 py-3 rounded-lg font-medium text-center hover:opacity-90 transition-opacity"
                        >
                            Upgrade Now
                        </a>
                        <button
                            onClick={handleClose}
                            className="px-4 py-3 rounded-lg font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>

                {/* Current tier indicator */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Current plan: <span className="font-medium capitalize">{currentTier}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

// Hook to show upgrade prompts based on API responses
export function useUpgradePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [promptProps, setPromptProps] = useState<Partial<UpgradePromptProps>>({});

    const triggerUpgradePrompt = (response: {
        upgradeRequired?: boolean;
        message?: string;
        error?: string;
        limit?: number;
        currentCount?: number;
    }) => {
        if (response.upgradeRequired) {
            setPromptProps({
                message: response.message || response.error || 'You have reached your plan limit.',
            });
            setShowPrompt(true);
        }
    };

    const closePrompt = () => setShowPrompt(false);

    return {
        showPrompt,
        promptProps,
        triggerUpgradePrompt,
        closePrompt,
        UpgradePromptComponent: showPrompt ? (
            <UpgradePrompt {...promptProps} message={promptProps.message || ''} onClose={closePrompt} />
        ) : null,
    };
}
