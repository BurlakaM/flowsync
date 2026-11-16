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
  ProjectImage,
  ProjectMembers,
  useProject,
} from '@/features/projects';
import { ActivityFeed } from '@/features/activity';
import { TagsManager } from '@/features/tasks';
import { ProjectTasks } from './project-tasks';

export default function ProjectRoute() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const project = useProject(projectId);
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
  if (project.isPending) return <LoadingState label={t('Loading project')} />;
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
      <div>
        <Link
          to="/projects"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {t('All projects')}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <ProjectImage project={data} className="size-16 text-2xl" />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{data.name}</h1>
              <p className="text-muted-foreground">
                {data.description || t('No description')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('Owner: {{name}}', { name: data.owner.name })}
              </p>
            </div>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t('Edit')}
              </Button>
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                {t('Delete')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ProjectTasks project={data} />

      <div className="grid gap-6 md:grid-cols-2">
        <ProjectMembers project={data} />
        <TagsManager projectId={data.id} canManage={isOwner} />
      </div>

      <ActivityFeed projectId={data.id} />

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
