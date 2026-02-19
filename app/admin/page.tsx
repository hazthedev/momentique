// ============================================
// Galeria - Supervisor Dashboard Overview
// ============================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Users,
    Calendar,
    Image as ImageIcon,
    TrendingUp,
    ArrowRight,
    Loader2,
    Shield
} from 'lucide-react';

interface DashboardStats {
    totalUsers: number;
    totalEvents: number;
    totalPhotos: number;
    activeEvents: number;
    recentUsers: number;
}

interface RecentActivityItem {
    id: string;
    type: 'user' | 'event' | 'photo' | 'moderation';
    createdAt: string;
    tenantName?: string | null;
    eventId?: string | null;
    eventName?: string | null;
    eventStatus?: string | null;
    organizerName?: string | null;
    contributorName?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    moderatorName?: string | null;
    moderatorEmail?: string | null;
    action?: string | null;
    photoStatus?: string | null;
    reason?: string | null;
    imageUrl?: string | null;
}

export default function SupervisorDashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        totalEvents: 0,
        totalPhotos: 0,
        activeEvents: 0,
        recentUsers: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/admin/stats', {
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    setStats(data.data || stats);
                }
            } catch (error) {
                console.error('Failed to fetch supervisor stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const fetchActivity = async () => {
            setActivityLoading(true);
            try {
                const response = await fetch('/api/admin/activity?limit=10', {
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    setRecentActivity(data.data || []);
                } else {
                    setRecentActivity([]);
                }
            } catch (error) {
                console.error('Failed to fetch recent activity:', error);
                setRecentActivity([]);
            } finally {
                setActivityLoading(false);
            }
        };

        fetchStats();
        fetchActivity();
    }, []);

    const statCards = [
        {
            label: 'Total Users',
            value: stats.totalUsers,
            icon: Users,
            color: 'bg-blue-500',
            href: '/admin/users'
        },
        {
            label: 'Total Events',
            value: stats.totalEvents,
            icon: Calendar,
            color: 'bg-violet-500',
            href: '/admin/events'
        },
        {
            label: 'Total Photos',
            value: stats.totalPhotos,
            icon: ImageIcon,
            color: 'bg-pink-500',
            href: null
        },
    ];

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
        );
    }

    const getActivityDetails = (item: RecentActivityItem) => {
        switch (item.type) {
            case 'user':
                return {
                    title: 'New user registered',
                    detail: `${item.userName || 'Unknown user'}${item.userEmail ? ` (${item.userEmail})` : ''}`,
                };
            case 'event':
                return {
                    title: 'New event created',
                    detail: `${item.eventName || 'Untitled event'}${item.organizerName ? ` - Organizer: ${item.organizerName}` : ''}`,
                };
            case 'photo':
                return {
                    title: 'Photo uploaded',
                    detail: `${item.contributorName || 'Anonymous'}${item.eventName ? ` - ${item.eventName}` : ''}`,
                };
            case 'moderation':
                return {
                    title: `Photo ${item.action || 'moderated'}`,
                    detail: `${item.moderatorName || item.moderatorEmail || 'Moderator'}${item.eventName ? ` - ${item.eventName}` : ''}`,
                };
            default:
                return {
                    title: 'Activity update',
                    detail: 'System activity logged',
                };
        }
    };

    const getStatusBadge = (item: RecentActivityItem) => {
        if (item.type === 'event' && item.eventStatus) {
            return (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {item.eventStatus}
                </span>
            );
        }

        if (item.type === 'photo' && item.photoStatus) {
            return (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                    {item.photoStatus}
                </span>
            );
        }

        if (item.type === 'moderation' && item.action) {
            return (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                    {item.action}
                </span>
            );
        }

        return null;
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Super Admin Dashboard
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    System-wide overview and management
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {stat.label}
                                </p>
                                <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
                                    {stat.value.toLocaleString()}
                                </p>
                            </div>
                            <div className={`rounded-lg ${stat.color} p-3`}>
                                <stat.icon className="h-6 w-6 text-white" />
                            </div>
                        </div>
                        {stat.href && (
                            <Link
                                href={stat.href}
                                className="mt-4 flex items-center text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                            >
                                View all <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        )}
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                    Quick Actions
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Link
                        href="/admin/users"
                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                            Manage Users
                        </span>
                    </Link>
                    <Link
                        href="/admin/events"
                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                        <Calendar className="h-5 w-5 text-violet-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                            Manage Events
                        </span>
                    </Link>
                    <Link
                        href="/admin/settings"
                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                        <Shield className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                            Platform Settings
                        </span>
                    </Link>
                </div>
            </div>

            {/* Recent Activity Placeholder */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Recent Activity
                    </h2>
                </div>
                <div className="mt-4 space-y-3">
                    {activityLoading ? (
                        <div className="flex h-28 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                        </div>
                    ) : recentActivity.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            No recent activity yet.
                        </div>
                    ) : (
                        recentActivity.map((item) => {
                            const Icon = item.type === 'moderation'
                                ? Shield
                                : item.type === 'photo'
                                    ? ImageIcon
                                    : item.type === 'event'
                                        ? Calendar
                                        : Users;
                            const details = getActivityDetails(item);

                            return (
                                <div
                                    key={item.id}
                                    className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-700/60">
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt="Activity preview"
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <Icon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {details.title}
                                            </p>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(item.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            {details.detail}
                                        </p>
                                        {item.reason && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Reason: {item.reason}
                                            </p>
                                        )}
                                        {getStatusBadge(item)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
