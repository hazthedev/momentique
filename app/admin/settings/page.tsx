// ============================================
// MOMENTIQUE - Supervisor Settings
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { Save, RefreshCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ISystemSettings } from '@/lib/types';

const DEFAULT_SETTINGS: ISystemSettings = {
  uploads: {
    max_file_mb: 10,
    allowed_types: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
  },
  moderation: {
    enabled: false,
    aws_region: 'us-east-1',
    aws_access_key_id: undefined,
    aws_secret_access_key: undefined,
    confidence_threshold: 0.8,
    auto_reject: true,
  },
  events: {
    default_settings: {
      theme: {
        primary_color: '#8B5CF6',
        secondary_color: '#EC4899',
        background: '#F9FAFB',
        logo_url: undefined,
        frame_template: 'polaroid',
      },
      features: {
        photo_upload_enabled: true,
        lucky_draw_enabled: true,
        reactions_enabled: true,
        moderation_required: false,
        anonymous_allowed: true,
        guest_download_enabled: true,
      },
      limits: {
        max_photos_per_user: 5,
        max_total_photos: 50,
        max_draw_entries: 30,
      },
    },
  },
};

const ALLOWED_TYPE_OPTIONS = [
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'PNG', value: 'image/png' },
  { label: 'HEIC', value: 'image/heic' },
  { label: 'WEBP', value: 'image/webp' },
];

const mergeSettings = (
  base: ISystemSettings,
  patch?: Partial<ISystemSettings>
): ISystemSettings => {
  if (!patch) return base;

  return {
    uploads: {
      ...base.uploads,
      ...(patch.uploads || {}),
      allowed_types: patch.uploads?.allowed_types || base.uploads.allowed_types,
    },
    moderation: {
      ...base.moderation,
      ...(patch.moderation || {}),
    },
    events: {
      default_settings: {
        theme: {
          ...base.events.default_settings.theme,
          ...(patch.events?.default_settings?.theme || {}),
        },
        features: {
          ...base.events.default_settings.features,
          ...(patch.events?.default_settings?.features || {}),
        },
        limits: {
          ...base.events.default_settings.limits,
          ...(patch.events?.default_settings?.limits || {}),
        },
      },
    },
  };
};

export default function SupervisorSettingsPage() {
  const [settings, setSettings] = useState<ISystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAwsKeys, setShowAwsKeys] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings', { credentials: 'include' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load settings');
      }

      setSettings(mergeSettings(DEFAULT_SETTINGS, data.data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('System settings updated');
      setSettings(mergeSettings(DEFAULT_SETTINGS, data.data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateAllowedTypes = (value: string, checked: boolean) => {
    const next = new Set(settings.uploads.allowed_types || []);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    setSettings((prev) => ({
      ...prev,
      uploads: { ...prev.uploads, allowed_types: Array.from(next) },
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure system-wide settings and defaults</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure system-wide settings and defaults
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Uploads</h2>
          <p className="mt-1 text-sm text-gray-500">Limits enforced on direct browser uploads.</p>
          <div className="mt-4 space-y-4 text-sm">
            <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
              <span>Max file size (MB)</span>
              <input
                type="number"
                min={1}
                value={settings.uploads.max_file_mb}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    uploads: { ...prev.uploads, max_file_mb: parseInt(e.target.value || '0', 10) },
                  }))
                }
                className="w-40 rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Allowed file types</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ALLOWED_TYPE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={settings.uploads.allowed_types.includes(option.value)}
                      onChange={(e) => updateAllowedTypes(option.value, e.target.checked)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Content Moderation</h2>
          <p className="mt-1 text-sm text-gray-500">
            AWS Rekognition for detecting inappropriate content. Free tier: 5,000 scans/month.
          </p>
          <div className="mt-4 space-y-4 text-sm">
            <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
              <span>Enable AI moderation</span>
              <input
                type="checkbox"
                checked={settings.moderation?.enabled || false}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    moderation: { ...prev.moderation, enabled: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
            </label>

            {settings.moderation?.enabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
                    <span>AWS Region</span>
                    <select
                      value={settings.moderation.aws_region || 'us-east-1'}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          moderation: { ...prev.moderation, aws_region: e.target.value },
                        }))
                      }
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
                    >
                      <option value="us-east-1">us-east-1</option>
                      <option value="us-east-2">us-east-2</option>
                      <option value="us-west-1">us-west-1</option>
                      <option value="us-west-2">us-west-2</option>
                      <option value="eu-west-1">eu-west-1</option>
                      <option value="eu-central-1">eu-central-1</option>
                      <option value="ap-southeast-1">ap-southeast-1</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
                    <span>Confidence Threshold ({Math.round((settings.moderation.confidence_threshold || 0.8) * 100)}%)</span>
                    <input
                      type="range"
                      min={0.5}
                      max={0.99}
                      step={0.01}
                      value={settings.moderation.confidence_threshold || 0.8}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          moderation: { ...prev.moderation, confidence_threshold: parseFloat(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={settings.moderation.auto_reject || false}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        moderation: { ...prev.moderation, auto_reject: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Auto-reject inappropriate content (otherwise flag for review)</span>
                </label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300">AWS Credentials</span>
                    <button
                      type="button"
                      onClick={() => setShowAwsKeys(!showAwsKeys)}
                      className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400"
                    >
                      {showAwsKeys ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
                    <span>AWS Access Key ID</span>
                    <input
                      type={showAwsKeys ? 'text' : 'password'}
                      value={settings.moderation.aws_access_key_id || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          moderation: { ...prev.moderation, aws_access_key_id: e.target.value || undefined },
                        }))
                      }
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
                    <span>AWS Secret Access Key</span>
                    <input
                      type={showAwsKeys ? 'text' : 'password'}
                      value={settings.moderation.aws_secret_access_key || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          moderation: { ...prev.moderation, aws_secret_access_key: e.target.value || undefined },
                        }))
                      }
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </label>

                  <p className="text-xs text-gray-500">
                    Credentials are stored securely in the database. Leave empty to use environment variables.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Default Event Theme</h2>
          <p className="mt-1 text-sm text-gray-500">Applied when organizers create new events.</p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
              <span>Primary color</span>
              <input
                type="text"
                value={settings.events.default_settings.theme.primary_color}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    events: {
                      default_settings: {
                        ...prev.events.default_settings,
                        theme: { ...prev.events.default_settings.theme, primary_color: e.target.value },
                      },
                    },
                  }))
                }
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
              <span>Secondary color</span>
              <input
                type="text"
                value={settings.events.default_settings.theme.secondary_color}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    events: {
                      default_settings: {
                        ...prev.events.default_settings,
                        theme: { ...prev.events.default_settings.theme, secondary_color: e.target.value },
                      },
                    },
                  }))
                }
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
              <span>Background</span>
              <input
                type="text"
                value={settings.events.default_settings.theme.background}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    events: {
                      default_settings: {
                        ...prev.events.default_settings,
                        theme: { ...prev.events.default_settings.theme, background: e.target.value },
                      },
                    },
                  }))
                }
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-gray-600 dark:text-gray-300">
              <span>Frame template</span>
              <select
                value={settings.events.default_settings.theme.frame_template}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    events: {
                      default_settings: {
                        ...prev.events.default_settings,
                        theme: { ...prev.events.default_settings.theme, frame_template: e.target.value },
                      },
                    },
                  }))
                }
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="polaroid">Polaroid</option>
                <option value="filmstrip">Filmstrip</option>
                <option value="classic">Classic</option>
                <option value="minimal">Minimal</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Default Event Features</h2>
          <p className="mt-1 text-sm text-gray-500">Feature toggles applied to newly created events.</p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(settings.events.default_settings.features).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      events: {
                        default_settings: {
                          ...prev.events.default_settings,
                          features: {
                            ...prev.events.default_settings.features,
                            [key]: e.target.checked,
                          },
                        },
                      },
                    }))
                  }
                />
                {key.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Default Event Limits</h2>
          <p className="mt-1 text-sm text-gray-500">Limits applied to new events.</p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(settings.events.default_settings.limits).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span>{key.replace(/_/g, ' ')}</span>
                <input
                  type="number"
                  value={value as number}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      events: {
                        default_settings: {
                          ...prev.events.default_settings,
                          limits: {
                            ...prev.events.default_settings.limits,
                            [key]: parseInt(e.target.value || '0', 10),
                          },
                        },
                      },
                    }))
                  }
                  className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
