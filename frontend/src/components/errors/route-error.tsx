import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-client';

/** Rendered by the router when a route throws while loading or rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : getErrorMessage(error, 'An unexpected error occurred.');

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <Button onClick={() => window.location.reload()}>Reload the page</Button>
    </div>
  );
}
