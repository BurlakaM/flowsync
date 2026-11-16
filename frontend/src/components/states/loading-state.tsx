import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/spinner';

/** The loading state of a screen or a section; announced to screen readers. */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={label ?? t('Loading')}
      className="flex justify-center py-12"
    >
      <Spinner className="size-6" />
    </div>
  );
}
