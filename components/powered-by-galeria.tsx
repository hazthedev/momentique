// ============================================
// GALERIA - Powered By Branding Component
// ============================================
// Shows "Powered by Galeria" watermark for free tier users

interface PoweredByGaleriaProps {
    className?: string;
    variant?: 'footer' | 'corner' | 'inline';
    showUpgradeLink?: boolean;
}

export function PoweredByGaleria({
    className = '',
    variant = 'footer',
    showUpgradeLink = true,
}: PoweredByGaleriaProps) {
    if (variant === 'corner') {
        return (
            <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
                <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Powered by</span>
                        <a
                            href="https://galeria.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-sm bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                        >
                            Galeria
                        </a>
                    </div>
                    {showUpgradeLink && (
                        <a
                            href="/upgrade"
                            className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline block mt-1"
                        >
                            Upgrade to remove
                        </a>
                    )}
                </div>
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <span className={`inline-flex items-center gap-1 ${className}`}>
                <span className="text-xs text-gray-400">Powered by</span>
                <a
                    href="https://galeria.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-xs bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent hover:opacity-80"
                >
                    Galeria
                </a>
            </span>
        );
    }

    // Footer variant (default)
    return (
        <div className={`py-4 text-center ${className}`}>
            <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Powered by</span>
                <a
                    href="https://galeria.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                >
                    Galeria
                </a>
            </div>
            {showUpgradeLink && (
                <a
                    href="/upgrade"
                    className="text-xs text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors mt-1 inline-block"
                >
                    Upgrade to remove branding
                </a>
            )}
        </div>
    );
}

// Wrapper component that conditionally shows branding based on tenant features
interface ConditionalBrandingProps extends PoweredByGaleriaProps {
    whiteLabel?: boolean;
}

export function ConditionalBranding({ whiteLabel, ...props }: ConditionalBrandingProps) {
    // If white_label is enabled, don't show branding
    if (whiteLabel) {
        return null;
    }

    return <PoweredByGaleria {...props} />;
}
