import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import {
  DeleteProjectDialog,
  ProjectFormDialog,
  ProjectMembers,
  useProject,
} from '@/features/projects';
import { TagsManager } from '@/features/tasks';
import { ProjectTasks } from './project-tasks';

export default function ProjectRoute() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const project = useProject(projectId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!Number.isInteger(projectId) || projectId < 1) {
    return (
      <EmptyState
        title="Project not found"
        description="The link is not valid."
      />
    );
  }
  if (project.isPending) return <LoadingState label="Loading project" />;
  if (project.isError) {
    return (
      <ErrorState
        error={project.error}
        what="the project"
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
          ← All projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <p className="text-muted-foreground">
              {data.description || 'No description'}
            </p>
            <p className="text-sm text-muted-foreground">
              Owner: {data.owner.name}
            </p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                Delete
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
