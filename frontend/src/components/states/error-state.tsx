import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage, getErrorStatus } from '@/lib/api-client';

interface ErrorStateProps {
  error: unknown;
  /** Shown as a "Try again" button when the request can simply be repeated. */
  onRetry?: () => void;
  /** What was being loaded, for the title: "Could not load projects". */
  what?: string;
}

/** The error of a screen: never an empty list in place of a failure. */
export function ErrorState({ error, onRetry, what = 'data' }: ErrorStateProps) {
  const status = getErrorStatus(error);
  const notFound = status === 404;

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center"
    >
      <TriangleAlert aria-hidden="true" className="size-8 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium">
          {notFound ? 'Not found' : `Could not load ${what}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? 'It does not exist or you do not have access to it.'
            : getErrorMessage(error)}
        </p>
      </div>
      {onRetry && !notFound && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
