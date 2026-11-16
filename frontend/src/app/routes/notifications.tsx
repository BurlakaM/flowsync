import { useTranslation } from 'react-i18next';
import { NotificationsList } from '@/features/notifications';

export default function NotificationsRoute() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('Notifications')}</h1>
      <NotificationsList />
    </div>
  );
}
