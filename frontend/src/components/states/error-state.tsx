import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage, getErrorStatus } from '@/lib/api-client';

interface ErrorStateProps {
  error: unknown;
  /** Shown as a "Try again" button when the request can simply be repeated. */
  onRetry?: () => void;
  /** The title of the failure, e.g. "Could not load projects" (already translated by the caller). */
  title?: string;
}

/** The error of a screen: never an empty list in place of a failure. */
export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const { t } = useTranslation();
  const status = getErrorStatus(error);
  const notFound = status === 404;

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive"
      >
        <TriangleAlert className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-heading text-lg font-semibold">
          {notFound ? t('Not found') : (title ?? t('Could not load the data'))}
        </p>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? t('It does not exist or you do not have access to it.')
            : getErrorMessage(error)}
        </p>
      </div>
      {onRetry && !notFound && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('Try again')}
        </Button>
      )}
    </div>
  );
}
