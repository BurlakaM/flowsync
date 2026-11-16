import { Spinner } from '@/components/spinner';

/** The loading state of a screen or a section; announced to screen readers. */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex justify-center py-12">
      <Spinner className="size-6" />
    </div>
  );
}
