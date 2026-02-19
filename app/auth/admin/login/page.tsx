// ============================================
// Galeria - Admin Login Page
// ============================================
// Dedicated login page for superadmins

import { AdminLoginForm } from '@/components/auth/admin-login-form';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AdminLoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="text-center">
                    <Link href="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-violet-900 dark:text-violet-400">
                            Galeria <span className="text-violet-500">Admin</span>
                        </h1>
                    </Link>
                    <div className="mt-6 flex items-center justify-center space-x-2">
                        <ShieldAlert className="h-6 w-6 text-violet-700 dark:text-violet-400" />
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            Admin Portal
                        </h2>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Secure access for system administrators only
                    </p>
                </div>

                {/* Login Form */}
                <div className="rounded-xl bg-white p-8 shadow-md ring-1 ring-violet-900/10 dark:bg-gray-800 dark:ring-violet-400/20">
                    <AdminLoginForm />
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-500">
                    <p>
                        Unauthorized access is prohibited and monitored.
                    </p>
                    <p className="mt-2 text-xs">
                        <Link
                            href="/auth/login"
                            className="text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
                        >
                            Back to regular login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
