import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  label?: string;
  /** `page` imitates a whole screen (a heading and rows); `section` is a few rows inside a card. */
  variant?: 'section' | 'page';
}

/** The loading state of a screen or a section: placeholders in the shape of the content, announced to screen readers. */
export function LoadingState({
  label,
  variant = 'section',
}: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={label ?? t('Loading')}
      className="space-y-3 py-2"
    >
      {variant === 'page' && (
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}
      {Array.from({ length: variant === 'page' ? 5 : 3 }, (_, index) => (
        <Skeleton
          key={index}
          className={variant === 'page' ? 'h-14 rounded-xl' : 'h-10'}
        />
      ))}
    </div>
  );
}
