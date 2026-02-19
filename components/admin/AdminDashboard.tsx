// ============================================
// Galeria - Admin Dashboard Component
// ============================================
// Event management, moderation, and analytics

'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  BarChart3,
  Users,
  Image as ImageIcon,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  Sparkles,
  Calendar,
  MapPin,
  Camera
} from 'lucide-react';
import type { IEvent, IPhoto, IEventStats } from '@/lib/types';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface AdminDashboardProps {
  eventId: string;
  tenantId: string;
}

// ============================================
// SUBCOMPONENTS
// ============================================

// Stats Card
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'purple',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: 'purple' | 'pink' | 'amber' | 'emerald';
}) {
  const colorClasses = {
    purple: 'bg-purple-500 text-white',
    pink: 'bg-pink-500 text-white',
    amber: 'bg-amber-500 text-white',
    emerald: 'bg-emerald-500 text-white',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500 mt-1">{trend}</p>
          )}
        </div>
        <div className={cn('p-3 rounded-lg', colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

// Pending Photos Queue
function PendingPhotosQueue({
  photos,
  onApprove,
  onReject,
}: {
  photos: IPhoto[];
  onApprove: (photoId: string) => void;
  onReject: (photoId: string) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
        <p>All photos reviewed!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {photos.map((photo) => (
        <div key={photo.id} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200">
          <div className="relative w-20 h-20 flex-shrink-0">
            <Image
              src={photo.images.thumbnail_url}
              alt={photo.caption || 'Photo'}
              width={80}
              height={80}
              className="w-full h-full object-cover rounded"
            />
          </div>
          <div className="flex-1 min-w-0">
            {photo.caption && (
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{photo.caption}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {!photo.is_anonymous && photo.contributor_name ? photo.contributor_name : 'Anonymous'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove(photo.id)}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Approve"
            >
              <CheckCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => onReject(photo.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Reject"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => window.open(photo.images.full_url, '_blank')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="View full size"
            >
              <Eye className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export function AdminDashboard({ eventId, tenantId }: AdminDashboardProps) {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'draw' | 'settings'>('overview');
  const [event, setEvent] = useState<IEvent | null>(null);
  const [stats, setStats] = useState<IEventStats | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<IPhoto[]>([]);
  const [drawEntriesTotal, setDrawEntriesTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // ============================================
  // DATA FETCHING
  // ============================================

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch event details
        const eventRes = await fetch(`/api/events/${eventId}`);
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEvent(eventData.data);
        }

        // Fetch stats
        const statsRes = await fetch(`/api/events/${eventId}/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.data);
        }

        // Fetch pending photos
        const photosRes = await fetch(`/api/events/${eventId}/photos?status=pending`);
        if (photosRes.ok) {
          const photosData = await photosRes.json();
          setPendingPhotos(photosData.data || []);
        }

        // Fetch draw entries
        const entriesRes = await fetch(`/api/events/${eventId}/lucky-draw/entries`);
        if (entriesRes.ok) {
          const entriesData = await entriesRes.json();
          setDrawEntriesTotal(entriesData.pagination?.total || 0);
        }
      } catch (error) {
        console.error('[Admin] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleApprovePhoto = useCallback(async (photoId: string) => {
    try {
      const res = await fetch(`/api/photos/${photoId}/approve`, { method: 'PATCH' });
      if (res.ok) {
        setPendingPhotos((prev) => prev.filter((p) => p.id !== photoId));
        if (stats) {
          setStats({ ...stats, photos_uploaded: stats.photos_uploaded + 1 });
        }
      }
    } catch (error) {
      console.error('[Admin] Error approving photo:', error);
    }
  }, [stats]);

  const handleRejectPhoto = useCallback(async (photoId: string) => {
    try {
      const res = await fetch(`/api/photos/${photoId}/reject`, { method: 'PATCH' });
      if (res.ok) {
        setPendingPhotos((prev) => prev.filter((p) => p.id !== photoId));
      }
    } catch (error) {
      console.error('[Admin] Error rejecting photo:', error);
    }
  }, []);

  const handleStartLuckyDraw = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/lucky-draw/draw`, { method: 'POST' });
      if (res.ok) {
        // Handle success
        console.log('[Admin] Lucky draw started');
      }
    } catch (error) {
      console.error('[Admin] Error starting lucky draw:', error);
    }
  }, [eventId]);

  const handleExportPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/export`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        window.open(data.download_url, '_blank');
      }
    } catch (error) {
      console.error('[Admin] Error exporting photos:', error);
    }
  }, [eventId]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event?.name || 'Event Dashboard'}</h1>
          <p className="text-gray-600 flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            {event?.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}
            {event?.location && (
              <>
                <span>•</span>
                <MapPin className="h-4 w-4" />
                {event.location}
              </>
            )}
          </p>
        </div>
        <button
          onClick={handleExportPhotos}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export Photos
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm transition-colors relative',
              activeTab === 'photos'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Photos
            {pendingPhotos.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {pendingPhotos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('draw')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'draw'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Lucky Draw
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'settings'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Settings
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Photos"
              value={stats?.photos_uploaded || 0}
              icon={ImageIcon}
              color="purple"
            />
            <StatCard
              title="Participants"
              value={stats?.unique_visitors || 0}
              icon={Users}
              color="pink"
            />
            <StatCard
              title="Lucky Draw Entries"
              value={drawEntriesTotal}
              icon={Sparkles}
              color="amber"
            />
            <StatCard
              title="Event Status"
              value={event?.status || 'draft'}
              icon={BarChart3}
              color="emerald"
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Camera className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Open Camera Upload</span>
              </button>
              <button
                onClick={handleStartLuckyDraw}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Sparkles className="h-5 w-5 text-amber-600" />
                <span className="font-medium">Start Lucky Draw</span>
              </button>
              <button
                onClick={handleExportPhotos}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-5 w-5 text-emerald-600" />
                <span className="font-medium">Export All Photos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Approval</h2>
            <PendingPhotosQueue
              photos={pendingPhotos}
              onApprove={handleApprovePhoto}
              onReject={handleRejectPhoto}
            />
          </div>
        </div>
      )}

      {activeTab === 'draw' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lucky Draw</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Total Entries</p>
                  <p className="text-sm text-gray-600">{drawEntriesTotal} participants</p>
                </div>
                <button
                  onClick={handleStartLuckyDraw}
                  disabled={drawEntriesTotal === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Start Draw
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  defaultValue={event?.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  defaultValue={event?.description}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Photo Moderation</p>
                  <p className="text-sm text-gray-600">Require approval before showing photos</p>
                </div>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default AdminDashboard;
