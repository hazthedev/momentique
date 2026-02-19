// ============================================
// Galeria - Lucky Draw Admin Tab
// ============================================
// Main admin panel for lucky draw configuration and management

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  AlertCircle,
  History,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import type { LuckyDrawConfig, LuckyDrawEntry, Winner } from '@/lib/types';
import { WinnerModal } from './WinnerModal';
import { ConfigTab } from './tabs/ConfigTab';
import { DrawTab } from './tabs/DrawTab';
import { EntriesTab } from './tabs/EntriesTab';
import { HistoryTab } from './tabs/HistoryTab';
import { ParticipantsTab } from './tabs/ParticipantsTab';
import type {
  ConfigFormState,
  LuckyDrawHistoryItem,
  LuckyDrawParticipant,
  ParticipantsSummary,
  PrizeTierForm,
  SubTab,
} from './types';
import { buildConfigForm, createPrizeTier } from './utils';

// ============================================
// TYPES
// ============================================

interface LuckyDrawAdminTabProps {
  eventId: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function LuckyDrawAdminTab({ eventId }: LuckyDrawAdminTabProps) {
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('config');

  // Data state
  const [config, setConfig] = useState<LuckyDrawConfig | null>(null);
  const [entries, setEntries] = useState<LuckyDrawEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [drawEntries, setDrawEntries] = useState<LuckyDrawEntry[]>([]);
  const [drawHistory, setDrawHistory] = useState<LuckyDrawHistoryItem[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [participants, setParticipants] = useState<LuckyDrawParticipant[]>([]);
  const [participantsSummary, setParticipantsSummary] = useState<ParticipantsSummary>({
    total: 0,
    uniqueParticipants: 0,
    totalEntries: 0,
  });

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [drawInProgress, setDrawInProgress] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(true);
  const [configForm, setConfigForm] = useState<ConfigFormState>(() => buildConfigForm(null));
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveError, setConfigSaveError] = useState<string | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const [manualEntryName, setManualEntryName] = useState('');
  const [manualEntryFingerprint, setManualEntryFingerprint] = useState('');
  const [manualEntryPhotoId, setManualEntryPhotoId] = useState('');
  const [manualEntryCount, setManualEntryCount] = useState(1);
  const [manualEntrySubmitting, setManualEntrySubmitting] = useState(false);
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [manualEntrySuccess, setManualEntrySuccess] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Pagination state for entries
  const [entriesPage, setEntriesPage] = useState(0);
  const entriesPageSize = 20;

  // Fetch user info
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, [eventId]);

  useEffect(() => {
    fetchEntries();
  }, [eventId, entriesPage]);

  useEffect(() => {
    if (activeSubTab === 'participants') {
      fetchParticipants();
    }
  }, [activeSubTab, eventId]);

  useEffect(() => {
    // Always show the edit form with config data pre-filled
    setConfigForm(buildConfigForm(config));
    setIsEditingConfig(true);
  }, [config]);

  // Poll for updates every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll if tab is active (user is viewing)
      fetchEntries();
      fetchDraws();
    }, 30000);

    return () => clearInterval(interval);
  }, [eventId]);

  // Clear success messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (manualEntrySuccess) {
      const timer = setTimeout(() => setManualEntrySuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [manualEntrySuccess]);

  // ============================================
  // DATA FETCHING FUNCTIONS
  // ============================================

  const fetchUserinfo = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUserRole(data.user?.role || null);
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to fetch user info:', err);
      setUserRole(null);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/lucky-draw/config`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok) {
        setConfig(data.data || null);
        setError(null);
      } else if (response.status !== 404) {
        setError(data.error || 'Failed to fetch config');
      } else {
        setConfig(null);
        setError(null);
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to fetch config:', err);
      setError('Failed to load configuration');
    }
  };

    const fetchEntries = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}/lucky-draw/entries?limit=${entriesPageSize}&offset=${entriesPage * entriesPageSize}`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data.data || []);
        setEntriesTotal(data.pagination?.total || 0);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to fetch entries');
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to fetch entries:', err);
      setError('Failed to load entries');
      }
    };

    const fetchDrawEntries = async () => {
      try {
        const limit = Math.max(entriesTotal, entriesPageSize, 1);
        const response = await fetch(
          `/api/events/${eventId}/lucky-draw/entries?limit=${limit}&offset=0`,
          {
            credentials: 'include',
          }
        );

        if (response.ok) {
          const data = await response.json();
          setDrawEntries(data.data || []);
        } else {
          setDrawEntries([]);
        }
      } catch (err) {
        console.error('[LUCKY_DRAW_ADMIN] Failed to fetch draw entries:', err);
        setDrawEntries([]);
      }
    };

  const fetchDraws = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/lucky-draw/history`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDrawHistory(data.data || []);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to fetch draw history');
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to fetch draws:', err);
      setError('Failed to load draw history');
    }
  };

  const fetchParticipants = async () => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/lucky-draw/participants`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setParticipants(data.data || []);
        setParticipantsSummary({
          total: data.pagination?.total || 0,
          uniqueParticipants: data.pagination?.uniqueParticipants || 0,
          totalEntries: data.pagination?.totalEntries || 0,
        });
      } else {
        const data = await response.json();
        setParticipantsError(data.error || 'Failed to fetch participants');
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to fetch participants:', err);
      setParticipantsError('Failed to load participants');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    await Promise.all([
      fetchUserinfo(),
      fetchConfig(),
      fetchEntries(),
      fetchDraws(),
    ]);
    setIsLoading(false);
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    setError(null);
    await Promise.all([fetchConfig(), fetchEntries(), fetchDraws()]);
    setIsRefreshing(false);
  };

  const updatePrizeTier = (index: number, updates: Partial<PrizeTierForm>) => {
    setConfigForm((prev) => {
      const prizeTiers = [...prev.prizeTiers];
      prizeTiers[index] = { ...prizeTiers[index], ...updates };
      return { ...prev, prizeTiers };
    });
  };

  const addPrizeTier = () => {
    setConfigForm((prev) => ({
      ...prev,
      prizeTiers: [...prev.prizeTiers, createPrizeTier(prev.prizeTiers)],
    }));
  };

  const removePrizeTier = (index: number) => {
    setConfigForm((prev) => {
      if (prev.prizeTiers.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        prizeTiers: prev.prizeTiers.filter((_, tierIndex) => tierIndex !== index),
      };
    });
  };

  const handleEditConfig = () => {
    setConfigSaveError(null);
    setConfigForm(buildConfigForm(config));
    setIsEditingConfig(true);
  };

  const handleCancelEdit = () => {
    if (!config) {
      return;
    }
    setConfigSaveError(null);
    setConfigForm(buildConfigForm(config));
    setIsEditingConfig(false);
  };

  const handleConfigSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfigSaveError(null);

    const trimmedTiers = configForm.prizeTiers.map((tier) => ({
      ...tier,
      name: tier.name.trim(),
      description: tier.description.trim(),
    }));

    if (trimmedTiers.length === 0) {
      setConfigSaveError('Add at least one prize tier.');
      return;
    }

    for (const tier of trimmedTiers) {
      if (!tier.name) {
        setConfigSaveError('Each prize tier needs a name.');
        return;
      }
      if (tier.count < 1) {
        setConfigSaveError('Prize counts must be at least 1.');
        return;
      }
    }

    if (configForm.maxEntriesPerUser < 1) {
      setConfigSaveError('Max entries per user must be at least 1.');
      return;
    }

    setIsSavingConfig(true);

    try {
      const response = await fetch(`/api/events/${eventId}/lucky-draw/config`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prizeTiers: trimmedTiers.map((tier) => ({
            ...tier,
            description: tier.description || undefined,
          })),
          maxEntriesPerUser: configForm.maxEntriesPerUser,
          requirePhotoUpload: configForm.requirePhotoUpload,
          preventDuplicateWinners: configForm.preventDuplicateWinners,
          animationStyle: configForm.animationStyle,
          animationDuration: configForm.animationDuration,
          showSelfie: configForm.showSelfie,
          showFullName: configForm.showFullName,
          playSound: configForm.playSound,
          confettiAnimation: configForm.confettiAnimation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setConfigSaveError(data.error || 'Failed to save configuration.');
        return;
      }

      setConfig(data.data || null);
      // Keep the form visible after save - don't switch to read-only view
      // setIsEditingConfig(false);
      setSuccessMessage('Draw configuration saved.');
      toast.success('Configuration saved successfully!');
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to save config:', err);
      setConfigSaveError('Failed to save configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ============================================
  // DRAW EXECUTION
  // ============================================

  const handleExecuteDraw = async () => {
    // Check user role first
    const isAdmin = userRole === 'super_admin' || userRole === 'organizer';
    if (!isAdmin) {
      toast.error('Access Denied: Only organizers can execute the lucky draw.');
      return;
    }

    // Check configuration exists
    if (!config) {
      toast.error('No Configuration: Please create a draw configuration first in the Configuration tab.');
      return;
    }

    // Check entries exist
    const entryCount = entriesTotal;
    if (entryCount === 0) {
      toast.error('No Entries: Users must upload photos to enter the draw. Add manual entries or wait for participants to upload photos.');
      return;
    }

    // Check status
    if (config.status !== 'scheduled') {
      toast.error(`Draw Status: The draw is currently "${config.status}". Only draws with "scheduled" status can be executed.`);
      return;
    }

    setDrawInProgress(true);
    setDrawError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}/lucky-draw`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

        if (response.ok) {
          // Set winners and show modal
          setWinners(data.data.winners);
          await fetchDrawEntries();
          setShowWinnerModal(true);

        // Refresh data to update status
        await fetchAllData();

        setSuccessMessage(`Successfully selected ${data.data.winners.length} winner(s)!`);
      } else {
        setDrawError(data.error || 'Failed to execute draw');
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to execute draw:', err);
      setDrawError('Failed to execute draw. Please try again.');
    } finally {
      setDrawInProgress(false);
    }
  };

  const handleManualEntrySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualEntryError(null);
    setManualEntrySuccess(null);

    const participantName = manualEntryName.trim();
    const participantFingerprint = manualEntryFingerprint.trim();
    const photoId = manualEntryPhotoId.trim();
    const entryCount = Number.isFinite(manualEntryCount) && manualEntryCount > 0 ? manualEntryCount : 1;

    if (!participantName) {
      setManualEntryError('Participant name is required.');
      return;
    }

    if (config?.requirePhotoUpload && !photoId) {
      setManualEntryError('Photo ID is required for this draw configuration.');
      return;
    }

    setManualEntrySubmitting(true);

    try {
      const response = await fetch(`/api/events/${eventId}/lucky-draw/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantName,
          participantFingerprint: participantFingerprint || undefined,
          photoId: photoId || undefined,
          entryCount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setManualEntryError(data.error || 'Failed to add manual entry.');
        return;
      }

      const createdCount = data.data?.entries?.length || 0;
      const fingerprint = data.data?.userFingerprint;

      setManualEntrySuccess(
        `Added ${createdCount} manual ${createdCount === 1 ? 'entry' : 'entries'}.${fingerprint ? ` Participant ID: ${fingerprint}` : ''}`
      );
      setManualEntryName('');
      setManualEntryFingerprint('');
      setManualEntryPhotoId('');
      setManualEntryCount(1);

      await Promise.all([fetchEntries(), fetchParticipants()]);
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to add manual entry:', err);
      setManualEntryError('Failed to add manual entry.');
    } finally {
      setManualEntrySubmitting(false);
    }
  };

  // Generate UUID for Participant ID
  const generateParticipantUUID = () => {
    const uuid = crypto.randomUUID();
    setManualEntryFingerprint(uuid);
    toast.success('Generated Participant ID: ' + uuid);
  };

  // Upload photo for manual entry
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setManualEntryError('Please select an image file.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setManualEntryError('Photo size must be less than 10MB.');
      return;
    }

    setPhotoUploading(true);
    setManualEntryError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contributor_name', manualEntryName || 'Admin');
      formData.append('is_anonymous', 'false');
      formData.append('join_lucky_draw', 'false'); // Don't auto-join, we'll create manual entry

        const response = await fetch(`/api/events/${eventId}/photos`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'x-admin-upload': 'true',
          },
          body: formData,
        });

      const data = await response.json();

      if (!response.ok) {
        setManualEntryError(data.error || 'Failed to upload photo.');
        return;
      }

      // Set the photo ID from the response - data is an array
      const photos = data.data;
      if (photos && photos.length > 0 && photos[0].id) {
        setManualEntryPhotoId(photos[0].id);
        toast.success('Photo uploaded! Photo ID: ' + photos[0].id);
      } else {
        setManualEntryError('Photo uploaded but no ID returned.');
      }
    } catch (err) {
      console.error('[LUCKY_DRAW_ADMIN] Failed to upload photo:', err);
      setManualEntryError('Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // ============================================
  // SUB-TAB NAVIGATION
  // ============================================

  const subTabs: { id: SubTab; label: string; icon: LucideIcon }[] = [
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'entries', label: 'Entries', icon: Users },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'draw', label: 'Execute Draw', icon: Play },
    { id: 'history', label: 'History', icon: History },
  ];

  // ============================================
  // LOADING STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================

  if (error && !config) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Failed to Load Lucky Draw
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && config && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                  activeSubTab === tab.id
                    ? 'border-violet-500 text-violet-600 dark:border-violet-400 dark:text-violet-400'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sub-tab content */}
      <div className="mt-6">
        {activeSubTab === 'config' && (
          <ConfigTab
            config={config}
            configForm={configForm}
            setConfigForm={setConfigForm}
            isEditingConfig={isEditingConfig}
            isSavingConfig={isSavingConfig}
            configSaveError={configSaveError}
            successMessage={successMessage}
            onSubmit={handleConfigSubmit}
            onCancelEdit={handleCancelEdit}
            onEditConfig={handleEditConfig}
            onUpdatePrizeTier={updatePrizeTier}
            onAddPrizeTier={addPrizeTier}
            onRemovePrizeTier={removePrizeTier}
          />
        )}
        {activeSubTab === 'entries' && (
          <EntriesTab
            entries={entries}
            entriesTotal={entriesTotal}
            entriesPage={entriesPage}
            entriesPageSize={entriesPageSize}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            userRole={userRole}
            config={config}
            manualEntryName={manualEntryName}
            manualEntryCount={manualEntryCount}
            manualEntryFingerprint={manualEntryFingerprint}
            manualEntryPhotoId={manualEntryPhotoId}
            manualEntrySubmitting={manualEntrySubmitting}
            manualEntryError={manualEntryError}
            manualEntrySuccess={manualEntrySuccess}
            photoUploading={photoUploading}
            onRefresh={refreshData}
            onSubmitManualEntry={handleManualEntrySubmit}
            onGenerateParticipantUUID={generateParticipantUUID}
            onPhotoUpload={handlePhotoUpload}
            setEntriesPage={setEntriesPage}
            setManualEntryName={setManualEntryName}
            setManualEntryCount={setManualEntryCount}
            setManualEntryFingerprint={setManualEntryFingerprint}
            setManualEntryPhotoId={setManualEntryPhotoId}
          />
        )}
        {activeSubTab === 'participants' && (
          <ParticipantsTab
            participants={participants}
            participantsSummary={participantsSummary}
            participantsLoading={participantsLoading}
            participantsError={participantsError}
            onRefresh={fetchParticipants}
          />
        )}
        {activeSubTab === 'draw' && (
          <DrawTab
            config={config}
            entriesTotal={entriesTotal}
            userRole={userRole}
            successMessage={successMessage}
            drawInProgress={drawInProgress}
            drawError={drawError}
            onExecuteDraw={handleExecuteDraw}
            onOpenConfig={() => setActiveSubTab('config')}
          />
        )}
        {activeSubTab === 'history' && (
          <HistoryTab
            drawHistory={drawHistory}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={refreshData}
          />
        )}
      </div>

      {/* Winner Modal */}
        {showWinnerModal && (
          <WinnerModal
            winners={winners}
            animationStyle={config?.animationStyle || 'slot'}
            animationDuration={config?.animationDuration || 8}
            showSelfie={config?.showSelfie ?? true}
            showFullName={config?.showFullName ?? true}
            confettiAnimation={config?.confettiAnimation ?? true}
            playSound={config?.playSound ?? false}
            entries={drawEntries.length > 0 ? drawEntries : entries}
            onClose={() => {
              setShowWinnerModal(false);
              setWinners([]);
              setDrawEntries([]);
            }}
          />
        )}
    </div>
  );
}

// ============================================
