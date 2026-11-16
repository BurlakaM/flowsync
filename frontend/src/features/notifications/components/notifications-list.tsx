import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/lib/format-date';
import { useState } from 'react';
import { Link } from 'react-router';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../api/notifications';
import { describeNotification } from '../utils/describe-notification';

export function NotificationsList() {
  const [page, setPage] = useState(1);
  const { t } = useTranslation();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useNotifications(page, unreadOnly);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const mutationError = markRead.error ?? markAllRead.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t('Filter')} className="flex gap-1">
          <Button
            variant={unreadOnly ? 'ghost' : 'secondary'}
            size="sm"
            aria-pressed={!unreadOnly}
            onClick={() => {
              setUnreadOnly(false);
              setPage(1);
            }}
          >
            {t('All')}
          </Button>
          <Button
            variant={unreadOnly ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={unreadOnly}
            onClick={() => {
              setUnreadOnly(true);
              setPage(1);
            }}
          >
            {t('Unread')}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!unread.data?.count || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          {t('Mark all as read')}
        </Button>
      </div>

      {mutationError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(mutationError)}
        </p>
      )}

      {notifications.isPending ? (
        <LoadingState label={t('Loading notifications')} />
      ) : notifications.isError ? (
        <ErrorState
          error={notifications.error}
          title={t('Could not load notifications')}
          onRetry={() => void notifications.refetch()}
        />
      ) : notifications.data.items.length === 0 ? (
        <EmptyState
          title={
            unreadOnly
              ? t('No unread notifications')
              : t('No notifications yet')
          }
          description={t(
            'You will see it here when someone assigns a task to you or comments on it.',
          )}
        />
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {notifications.data.items.map((notification) => {
              const view = describeNotification(notification);
              const isUnread = notification.readAt === null;
              return (
                <li
                  key={notification.id}
                  className={cn(
                    'flex items-start justify-between gap-3 p-4',
                    isUnread && 'bg-muted/40',
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <p className={cn('text-sm', isUnread && 'font-medium')}>
                      {view.to ? (
                        <Link
                          to={view.to}
                          className="hover:underline"
                          onClick={() => {
                            if (isUnread) markRead.mutate(notification.id);
                          }}
                        >
                          {view.text}
                        </Link>
                      ) : (
                        view.text
                      )}
                    </p>
                    <time
                      dateTime={notification.createdAt}
                      className="text-xs text-muted-foreground"
                    >
                      {formatDateTime(notification.createdAt)}
                    </time>
                  </div>
                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('Mark as read: {{text}}', {
                        text: view.text,
                      })}
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(notification.id)}
                    >
                      {t('Mark as read')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination
            page={notifications.data.meta.page}
            totalPages={notifications.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
