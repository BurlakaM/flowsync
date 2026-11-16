import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export default function NotFoundRoute() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-semibold">404</p>
      <h1 className="text-xl font-medium">{t('Page not found')}</h1>
      <p className="text-muted-foreground">
        {t('The page you are looking for does not exist or has moved.')}
      </p>
      <Button asChild>
        <Link to="/">{t('Back to projects')}</Link>
      </Button>
    </main>
  );
}
