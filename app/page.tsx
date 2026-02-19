// ============================================
// GALERIA - Landing Page
// ============================================
// Simple landing page with organizer and admin login options

import Link from 'next/link';
import { Users, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-white to-pink-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />

      {/* Decorative Blobs */}
      <div className="absolute top-0 -left-40 h-80 w-80 rounded-full bg-violet-300/40 blur-3xl dark:bg-violet-900/30" />
      <div className="absolute bottom-0 -right-40 h-80 w-80 rounded-full bg-pink-300/40 blur-3xl dark:bg-pink-900/30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-fuchsia-200/30 blur-3xl dark:bg-fuchsia-900/20" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl px-4 py-16">
        {/* Logo */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold leading-normal py-2 bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
            Galeria
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
            Capture Moments, Together
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Rakam Momen, Bersama
          </p>
        </div>

        {/* Login Cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Organizer Card */}
          <Link
            href="/auth/login"
            className="group relative flex flex-col items-center rounded-2xl border-2 border-white/60 bg-white/70 backdrop-blur-sm p-8 shadow-lg transition-all hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 dark:border-gray-700/60 dark:bg-gray-800/70 dark:hover:border-violet-500"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg transition-transform group-hover:scale-110">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Organizer
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Create and manage your events
            </p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-violet-600 dark:text-violet-400 transition-transform group-hover:translate-x-1">
              Login {'->'}
            </span>
          </Link>

          {/* Admin Card */}
          <Link
            href="/auth/admin/login"
            className="group relative flex flex-col items-center rounded-2xl border-2 border-white/60 bg-white/70 backdrop-blur-sm p-8 shadow-lg transition-all hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 dark:border-gray-700/60 dark:bg-gray-800/70 dark:hover:border-violet-500"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white shadow-lg transition-transform group-hover:scale-110">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Admin
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              System administration
            </p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-violet-600 dark:text-violet-400 transition-transform group-hover:translate-x-1">
              Login {'->'}
            </span>
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-16 text-center text-xs text-gray-500 dark:text-gray-500">
          (c) 2025 Galeria
        </p>
      </div>
    </div>
  );
}
