import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '../api/notifications';

/** The bell in the header: a link to the notifications with the number of unread ones. */
export function NotificationsLink() {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;

  return (
    <NavLink
      to="/notifications"
      aria-label={
        count > 0
          ? t('Notifications, unread: {{count}}', { count })
          : t('Notifications')
      }
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
          isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
        )
      }
    >
      <Bell aria-hidden="true" className="size-4" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  );
}
