import { useTranslation } from 'react-i18next';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn('size-5 animate-spin text-muted-foreground', className)}
    />
  );
}

/** Fills the screen while the first route or the session is loading. */
export function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('Loading')}
      className="flex min-h-screen items-center justify-center"
    >
      <Spinner className="size-8" />
    </div>
  );
}
