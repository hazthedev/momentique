import Link from 'next/link';

interface FeatureDisabledNoticeProps {
  featureName: string;
  settingsFeaturesHref?: string;
  description?: string;
}

export function FeatureDisabledNotice({
  featureName,
  settingsFeaturesHref,
  description,
}: FeatureDisabledNoticeProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
      <h3 className="text-base font-semibold">{featureName} is disabled</h3>
      <p className="mt-2 text-sm">
        {description || `This feature is currently disabled in Event Settings.`}{' '}
        {settingsFeaturesHref ? (
          <Link href={settingsFeaturesHref} className="font-semibold underline underline-offset-2">
            Click here to enable it.
          </Link>
        ) : null}
      </p>
    </div>
  );
}
