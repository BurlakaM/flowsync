import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelativeTime } from '@/lib/format-date';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMe } from '@/features/auth';
import { CommentsSection } from '@/features/comments';
import { useProject, useRefreshProjects } from '@/features/projects';
import {
  DeleteTaskDialog,
  StatusSelect,
  TagChip,
  TaskFormDialog,
  useTags,
  useRefreshTasks,
  useTask,
} from '@/features/tasks';

export default function TaskRoute() {
  const taskId = Number(useParams().taskId);
  const navigate = useNavigate();
  const task = useTask(taskId);
  // The members of the project are the people a task can be assigned to.
  const project = useProject(task.data?.projectId ?? 0);
  const tags = useTags(task.data?.projectId ?? 0);
  const refreshProjects = useRefreshProjects();
  const refreshTasks = useRefreshTasks();
  const me = useMe();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation();

  if (!Number.isInteger(taskId) || taskId < 1) {
    return (
      <EmptyState
        title={t('Task not found')}
        description={t('The link is not valid.')}
      />
    );
  }
  if (task.isPending) {
    return <LoadingState variant="page" label={t('Loading task')} />;
  }
  if (task.isError) {
    return (
      <ErrorState
        error={task.error}
        title={t('Could not load the task')}
        onRetry={() => void task.refetch()}
      />
    );
  }

  const { data } = task;
  const assignees = (project.data?.members ?? []).map((member) => ({
    id: member.userId,
    name: member.name,
  }));

  return (
    <div className="space-y-6">
      <Link
        to={`/projects/${data.project.id}`}
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {data.project.name}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold">{data.name}</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                {t('Edit')}
              </Button>
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 data-icon="inline-start" />
                {t('Delete')}
              </Button>
            </div>
          </div>

          <section aria-labelledby="description-heading" className="space-y-3">
            <h2 id="description-heading" className="text-lg font-semibold">
              {t('Description')}
            </h2>
            <div className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {data.description || (
                  <span className="text-muted-foreground">
                    {t('No description')}
                  </span>
                )}
              </p>
            </div>
          </section>

          {me.data && (
            <CommentsSection
              taskId={data.id}
              currentUserId={me.data.id}
              isProjectOwner={project.data?.myRole === 'OWNER'}
              onChanged={() => void refreshTasks()}
            />
          )}
        </div>

        <aside aria-label={t('Details')} className="content-start">
          <Card size="sm">
            <CardContent>
              <dl className="space-y-5 text-sm">
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">{t('Status')}</dt>
                  <dd>
                    <StatusSelect
                      variant="pill"
                      taskId={data.id}
                      taskName={data.name}
                      status={data.status}
                    />
                  </dd>
                </div>
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">{t('Assignees')}</dt>
                  <dd>
                    {data.assignees.length > 0 ? (
                      <ul className="space-y-2">
                        {data.assignees.map((user) => (
                          <li key={user.id} className="flex items-center gap-2">
                            <Avatar
                              name={user.name}
                              seed={user.id}
                              size="sm"
                              decorative
                            />
                            {user.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      t('Nobody')
                    )}
                  </dd>
                </div>
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">{t('Tags')}</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {data.tags.length > 0
                      ? data.tags.map((tag) => (
                          <TagChip key={tag.id} tag={tag} />
                        ))
                      : t('None')}
                  </dd>
                </div>
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">{t('Created')}</dt>
                  <dd>
                    {formatDate(data.createdAt)}
                    {data.createdBy
                      ? ` ${t('by {{name}}', { name: data.createdBy.name })}`
                      : ''}
                  </dd>
                </div>
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">{t('Updated')}</dt>
                  <dd>{formatRelativeTime(data.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <TaskFormDialog
        open={editing}
        onOpenChange={setEditing}
        projectId={data.projectId}
        task={data}
        assignees={assignees}
        tags={tags.data ?? []}
      />
      <DeleteTaskDialog
        task={data}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => {
          void refreshProjects();
          navigate(`/projects/${data.projectId}`, { replace: true });
        }}
      />
    </div>
  );
}
