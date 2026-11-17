import {
  CircleCheck,
  FolderKanban,
  MessageSquare,
  Tag,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatRelativeTime } from '@/lib/format-date';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
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

/** A glyph for what the entry is about, so the timeline can be skimmed without reading. */
const ENTITY_ICONS: Record<string, LucideIcon> = {
  Task: CircleCheck,
  Comment: MessageSquare,
  Member: UserPlus,
  Tag,
  Project: FolderKanban,
};

/** What happened in a project lately: who did what, newest first, on a timeline. */
export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const { t } = useTranslation();
  const activity = useActivity(projectId);
  const entries = activity.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card size="sm">
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
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('Nothing happened yet.')}
          </p>
        ) : (
          <>
            <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px before:bg-border">
              {entries.map((entry) => {
                const Icon = ENTITY_ICONS[entry.entityType] ?? CircleCheck;
                return (
                  <li key={entry.id} className="relative flex gap-3 text-sm">
                    <span
                      aria-hidden="true"
                      className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground ring-4 ring-card"
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                      <p className="leading-snug">
                        <span className="font-medium">
                          {entry.actor?.name ?? t('Someone')}
                        </span>{' '}
                        {describeActivity(entry)}
                      </p>
                      <time
                        dateTime={entry.createdAt}
                        title={formatDateTime(entry.createdAt)}
                        className="text-xs text-muted-foreground"
                      >
                        {formatRelativeTime(entry.createdAt)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
            {activity.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                disabled={activity.isFetchingNextPage}
                onClick={() => void activity.fetchNextPage()}
              >
                {t('Show older activity')}
              </Button>
            )}
            {activity.isFetchNextPageError && (
              <p role="alert" className="text-xs text-destructive">
                {t('Could not load older activity')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
