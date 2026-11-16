import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { useRefreshProjects, type ProjectDetails } from '@/features/projects';
import {
  applyTaskFilters,
  hasActiveFilters,
  parseTaskFilters,
  TaskFiltersBar,
  TaskFormDialog,
  TaskList,
  useProjectTasks,
  useTags,
} from '@/features/tasks';

interface ProjectTasksProps {
  project: ProjectDetails;
}

/** The tasks of a project: this page composes the tasks feature with the members of the projects feature. */
export function ProjectTasks({ project }: ProjectTasksProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const refreshProjects = useRefreshProjects();

  // Filters, sorting and the page live in the URL: the list can be shared and survives a reload.
  const filters = parseTaskFilters(params);
  const tasks = useProjectTasks(project.id, filters);
  const tags = useTags(project.id);

  const assignees = project.members.map((member) => ({
    id: member.userId,
    name: member.name,
  }));
  const tagList = tags.data ?? [];

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tasks-heading" className="text-xl font-semibold">
          Tasks
        </h2>
        <Button onClick={() => setCreating(true)}>New task</Button>
      </div>

      <TaskFiltersBar
        filters={filters}
        assignees={assignees}
        tags={tagList}
        onChange={(changes) => setParams(applyTaskFilters(params, changes))}
      />

      {tasks.isPending ? (
        <LoadingState label="Loading tasks" />
      ) : tasks.isError ? (
        <ErrorState
          error={tasks.error}
          what="tasks"
          onRetry={() => void tasks.refetch()}
        />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters(filters)
              ? 'No tasks match the filters'
              : 'No tasks yet'
          }
          description={
            hasActiveFilters(filters)
              ? 'Try changing or clearing the filters.'
              : 'Create the first task of this project.'
          }
          action={
            hasActiveFilters(filters) ? (
              <Button
                variant="outline"
                onClick={() =>
                  setParams(
                    applyTaskFilters(params, {
                      status: undefined,
                      assigneeId: undefined,
                      tagId: undefined,
                      search: undefined,
                    }),
                  )
                }
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>New task</Button>
            )
          }
        />
      ) : (
        <>
          <TaskList tasks={tasks.data.items} />
          <Pagination
            page={tasks.data.meta.page}
            totalPages={tasks.data.meta.totalPages}
            onPageChange={(page) =>
              setParams(applyTaskFilters(params, { page }))
            }
          />
        </>
      )}

      <TaskFormDialog
        open={creating}
        onOpenChange={setCreating}
        projectId={project.id}
        assignees={assignees}
        tags={tagList}
        onSaved={(task) => {
          void refreshProjects();
          navigate(`/tasks/${task.id}`);
        }}
      />
    </section>
  );
}
