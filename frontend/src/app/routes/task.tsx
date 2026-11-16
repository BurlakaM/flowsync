import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/format-date';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth';
import { CommentsSection } from '@/features/comments';
import { useProject, useRefreshProjects } from '@/features/projects';
import {
  DeleteTaskDialog,
  StatusSelect,
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
  if (task.isPending) return <LoadingState label={t('Loading task')} />;
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
      <div>
        <Link
          to={`/projects/${data.project.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {data.project.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              {t('Edit')}
            </Button>
            <Button variant="destructive" onClick={() => setDeleting(true)}>
              {t('Delete')}
            </Button>
          </div>
        </div>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-muted-foreground">{t('Status')}</dt>
          <dd>
            <StatusSelect
              taskId={data.id}
              taskName={data.name}
              status={data.status}
            />
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">{t('Assignees')}</dt>
          <dd>
            {data.assignees.length > 0
              ? data.assignees.map((user) => user.name).join(', ')
              : t('Nobody')}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">{t('Tags')}</dt>
          <dd className="flex flex-wrap gap-2">
            {data.tags.length > 0
              ? data.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))
              : t('None')}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">{t('Created')}</dt>
          <dd>
            {formatDate(data.createdAt)}
            {data.createdBy
              ? ` ${t('by {{name}}', { name: data.createdBy.name })}`
              : ''}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="description-heading" className="space-y-2">
        <h2 id="description-heading" className="text-lg font-semibold">
          {t('Description')}
        </h2>
        <p className="whitespace-pre-wrap text-sm">
          {data.description || (
            <span className="text-muted-foreground">{t('No description')}</span>
          )}
        </p>
      </section>

      {me.data && (
        <CommentsSection
          taskId={data.id}
          currentUserId={me.data.id}
          isProjectOwner={project.data?.myRole === 'OWNER'}
          onChanged={() => void refreshTasks()}
        />
      )}

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
