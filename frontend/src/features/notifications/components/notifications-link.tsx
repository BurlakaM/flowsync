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
          'relative grid size-9 place-items-center rounded-lg transition-colors hover:bg-accent/70 hover:text-accent-foreground',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground',
        )
      }
    >
      <Bell aria-hidden="true" className="size-[18px]" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground ring-2 ring-background"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  );
}
