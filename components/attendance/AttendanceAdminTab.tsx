// ============================================
// Galeria - Attendance Admin Tab Component
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { Users, Download, Upload, UserPlus, Loader2, Search, ChevronLeft, ChevronRight, QrCode, ScanLine, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { OrganizerQRScanner } from '@/components/attendance/OrganizerQRScanner';
import { generateCheckInUrl, generateCheckInQRCodeUrl } from '@/lib/qrcode';

interface AttendanceAdminTabProps {
  eventId: string;
  initialTab?: AdminSubTab;
}

interface AttendanceRecord {
  id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  companions_count: number;
  check_in_time: string;
  check_in_method: string;
}

interface AttendanceStats {
  total_check_ins: number;
  total_guests: number;
  check_ins_today: number;
  unique_guests: number;
  average_companions: number;
  check_in_method_breakdown: Record<string, number>;
}

type AdminSubTab = 'overview' | 'guests' | 'manual' | 'import' | 'qr';

export function AttendanceAdminTab({ eventId, initialTab }: AttendanceAdminTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>(initialTab || 'overview');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // QR Code state
  const [copiedLink, setCopiedLink] = useState(false);
  const checkInUrl = typeof window !== 'undefined' ? generateCheckInUrl(eventId) : '';
  const qrCodeUrl = generateCheckInQRCodeUrl(eventId);

  // Manual entry form state
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualGuestEmail, setManualGuestEmail] = useState('');
  const [manualGuestPhone, setManualGuestPhone] = useState('');
  const [manualCompanions, setManualCompanions] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [eventId, currentPage, activeSubTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [attendanceRes, statsRes] = await Promise.all([
        fetch(`/api/events/${eventId}/attendance?limit=50&offset=${(currentPage - 1) * 50}`, {
          credentials: 'include',
        }),
        fetch(`/api/events/${eventId}/attendance/stats`, {
          credentials: 'include',
        }),
      ]);

      if (attendanceRes.ok) {
        const data = await attendanceRes.json();
        setAttendances(data.data || []);
        setTotalPages(Math.ceil((data.pagination?.total || 0) / 50));
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualGuestName.trim()) {
      toast.error('Guest name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/attendance/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guest_name: manualGuestName,
          guest_email: manualGuestEmail || undefined,
          guest_phone: manualGuestPhone || undefined,
          companions_count: manualCompanions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      toast.success('Guest checked in successfully');
      setManualGuestName('');
      setManualGuestEmail('');
      setManualGuestPhone('');
      setManualCompanions(0);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Check-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCheckInLink = () => {
    navigator.clipboard.writeText(checkInUrl);
    setCopiedLink(true);
    toast.success('Check-in link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `checkin-qr-${eventId}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR Code downloaded!');
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/attendance/export`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${eventId}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const filteredAttendances = attendances.filter((a) =>
    a.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.guest_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.guest_phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'overview' as const, label: 'Dashboard', icon: Users },
          { id: 'guests' as const, label: 'Guest List', icon: Users },
          { id: 'manual' as const, label: 'Manual Check-in', icon: UserPlus },
          { id: 'qr' as const, label: 'QR Codes', icon: QrCode },
          { id: 'import' as const, label: 'Import/Export', icon: Upload },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeSubTab === tab.id
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeSubTab === 'overview' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats ? (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Check-ins</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.total_check_ins}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Guests</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.total_guests}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Including companions</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.check_ins_today}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Check-ins today</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unique Guests</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.unique_guests}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">With email</p>
              </div>
            </>
          ) : (
            <div className="col-span-full flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          )}
        </div>
      )}

      {/* Guest List Tab */}
      {activeSubTab === 'guests' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          ) : filteredAttendances.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <Users className="mb-2 h-12 w-12 opacity-50" />
              <p>No check-ins yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Guest
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Companions
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Check-in Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Method
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredAttendances.map((attendance) => (
                      <tr key={attendance.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {attendance.guest_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {attendance.guest_email || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {attendance.guest_phone || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {attendance.companions_count}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(attendance.check_in_time).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {attendance.check_in_method}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual Entry Tab */}
      {activeSubTab === 'manual' && (
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manual Check-in
          </h3>
          <form onSubmit={handleManualCheckIn} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={manualGuestName}
                onChange={(e) => setManualGuestName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="Guest name"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={manualGuestEmail}
                onChange={(e) => setManualGuestEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="email@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone
              </label>
              <input
                type="tel"
                value={manualGuestPhone}
                onChange={(e) => setManualGuestPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="+1 234 567 8900"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Companions
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setManualCompanions(Math.max(0, manualCompanions - 1))}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  -
                </button>
                <span className="w-12 text-center font-semibold">{manualCompanions}</span>
                <button
                  type="button"
                  onClick={() => setManualCompanions(manualCompanions + 1)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !manualGuestName.trim()}
              className={clsx(
                'w-full rounded-lg py-2.5 font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSubmitting || !manualGuestName.trim()
                  ? 'bg-gray-400'
                  : 'bg-violet-600 hover:bg-violet-700'
              )}
            >
              {isSubmitting ? 'Checking in...' : 'Check In Guest'}
            </button>
          </form>
        </div>
      )}

      {/* QR Codes Tab */}
      {activeSubTab === 'qr' && (
        <div className="space-y-6">
          {/* QR Code Sub-tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveSubTab('qr')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                'border-violet-600 text-violet-600'
              )}
            >
              <QrCode className="h-4 w-4" />
              Generate QR Code
            </button>
          </div>

          {/* Generate QR Code Section */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* QR Code Display */}
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Check-in QR Code
              </h3>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Share this QR code with guests. When they scan it, they&apos;ll be taken directly to the check-in page.
              </p>

              {/* QR Code Image */}
              <div className="mb-6 flex justify-center">
                <div className="rounded-lg border-4 border-white p-4 shadow-lg dark:border-gray-700">
                  <img
                    src={qrCodeUrl}
                    alt="Event Check-in QR Code"
                    className="h-64 w-64"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDownloadQR}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  Download QR Code
                </button>
              </div>
            </div>

            {/* Check-in Link */}
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Check-in Link
              </h3>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Share this direct link with guests for quick check-in access.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Direct Link
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 break-all">
                      {checkInUrl}
                    </code>
                    <button
                      onClick={handleCopyCheckInLink}
                      className={clsx(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                        copiedLink
                          ? 'bg-emerald-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
                  <h4 className="mb-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
                    How to use
                  </h4>
                  <ol className="space-y-2 text-sm text-violet-800 dark:text-violet-200">
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-semibold text-violet-900 dark:bg-violet-800 dark:text-violet-200">
                        1
                      </span>
                      <span>Download the QR code image</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-semibold text-violet-900 dark:bg-violet-800 dark:text-violet-200">
                        2
                      </span>
                      <span>Display it at your event venue</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-semibold text-violet-900 dark:bg-violet-800 dark:text-violet-200">
                        3
                      </span>
                      <span>Guests scan to check in instantly</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Scan Guest QR Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Scan Guest QR Code
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              Scan a guest&apos;s QR code to verify their check-in status or manually check them in.
            </p>
            <OrganizerQRScanner eventId={eventId} />
          </div>
        </div>
      )}

      {/* Import/Export Tab */}
      {activeSubTab === 'import' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Export Attendance
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Download all attendance data as a CSV file for use in spreadsheets or other tools.
            </p>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </button>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              CSV Import (Coming Soon)
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Bulk import guests from a CSV file
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
