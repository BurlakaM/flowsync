import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/lib/format-date';
import { useState } from 'react';
import { Pagination } from '@/components/pagination';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useActivity } from '../api/get-activity';
import { describeActivity } from '../utils/describe-activity';

interface ActivityFeedProps {
  projectId: number;
}

/** What happened in a project lately: who did what, newest first. */
export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [page, setPage] = useState(1);
  const { t } = useTranslation();
  const activity = useActivity(projectId, page);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('Activity')}</h2>
        </CardTitle>
        <CardDescription>
          {t('The latest changes in this project.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activity.isPending ? (
          <LoadingState label={t('Loading activity')} />
        ) : activity.isError ? (
          <ErrorState
            error={activity.error}
            title={t('Could not load the activity')}
            onRetry={() => void activity.refetch()}
          />
        ) : activity.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('Nothing happened yet.')}
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {activity.data.items.map((entry) => (
                <li key={entry.id} className="space-y-1 py-2 text-sm">
                  <p>
                    <span className="font-medium">
                      {entry.actor?.name ?? t('Someone')}
                    </span>{' '}
                    {describeActivity(entry)}
                  </p>
                  <time
                    dateTime={entry.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {formatDateTime(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
            <Pagination
              page={activity.data.meta.page}
              totalPages={activity.data.meta.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
