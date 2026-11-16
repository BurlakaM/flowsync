import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Previous / next controls; renders nothing when everything fits on one page. */
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={t('Pagination')}
      className="flex items-center justify-between pt-4"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('Previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('Page {{page}} of {{totalPages}}', { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('Next')}
      </Button>
    </nav>
  );
}
