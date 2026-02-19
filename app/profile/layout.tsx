// ============================================
// GALERIA - Profile Layout
// ============================================

'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, Plus, User, LogOut, ArrowLeft } from 'lucide-react';

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useAuth();

    // Redirect non-authenticated users
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/auth/login');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Simple header for profile page */}
            <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/organizer" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                                <ArrowLeft className="h-5 w-5" />
                                <span className="text-sm font-medium">Back to Dashboard</span>
                            </Link>
                        </div>
                        <Link href="/" className="flex items-center gap-2">
                            <Image
                                src="/logo.png"
                                alt="Galeria Logo"
                                width={32}
                                height={32}
                                className="h-8 w-auto"
                            />
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                                Galeria
                            </span>
                        </Link>
                    </div>
                </div>
            </header>
            {children}
        </div>
    );
}
