import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import {
  DeleteProjectDialog,
  ProjectFormDialog,
  ProjectHeader,
  ProjectMembers,
  useProject,
} from '@/features/projects';
import { ActivityFeed } from '@/features/activity';
import { TagsManager, useTaskCounts } from '@/features/tasks';
import { ProjectTasks } from './project-tasks';

export default function ProjectRoute() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const project = useProject(projectId);
  // The whole project, whatever the list below is filtered by: that is what the progress bar shows.
  const counts = useTaskCounts(projectId, {});
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation();

  if (!Number.isInteger(projectId) || projectId < 1) {
    return (
      <EmptyState
        title={t('Project not found')}
        description={t('The link is not valid.')}
      />
    );
  }
  if (project.isPending) {
    return <LoadingState variant="page" label={t('Loading project')} />;
  }
  if (project.isError) {
    return (
      <ErrorState
        error={project.error}
        title={t('Could not load the project')}
        onRetry={() => void project.refetch()}
      />
    );
  }

  const { data } = project;
  const isOwner = data.myRole === 'OWNER';

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('All projects')}
      </Link>

      <ProjectHeader
        project={data}
        progress={
          counts.all === undefined
            ? undefined
            : { done: counts.DONE ?? 0, total: counts.all }
        }
        actions={
          isOwner && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                {t('Edit')}
              </Button>
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 data-icon="inline-start" />
                {t('Delete')}
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ProjectTasks project={data} />

        <aside
          aria-label={t('Project details')}
          className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-1"
        >
          <ProjectMembers project={data} />
          <TagsManager projectId={data.id} canManage={isOwner} />
          <div className="md:col-span-2 xl:col-span-1">
            <ActivityFeed projectId={data.id} />
          </div>
        </aside>
      </div>

      <ProjectFormDialog
        open={editing}
        onOpenChange={setEditing}
        project={data}
      />
      <DeleteProjectDialog
        project={data}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate('/projects', { replace: true })}
      />
    </div>
  );
}
