import { useTranslation } from 'react-i18next';
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
  TaskBoard,
  TaskList,
  useProjectTasks,
  BOARD_PAGE_SIZE,
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
  const { t } = useTranslation();

  // Filters, sorting and the page live in the URL: the list can be shared and survives a reload.
  const filters = parseTaskFilters(params);
  // The board shows every status at once, so it loads as many tasks as one request allows and has no pages.
  const view = params.get('view') === 'board' ? 'board' : 'list';
  const tasks = useProjectTasks(
    project.id,
    filters,
    view === 'board' ? BOARD_PAGE_SIZE : undefined,
  );
  const setView = (next: 'list' | 'board') => {
    const nextParams = new URLSearchParams(params);
    if (next === 'board') nextParams.set('view', 'board');
    else nextParams.delete('view');
    setParams(nextParams);
  };
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
          {t('Tasks')}
        </h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label={t('View')} className="flex gap-1">
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              {t('List')}
            </Button>
            <Button
              variant={view === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
            >
              {t('Board')}
            </Button>
          </div>
          <Button onClick={() => setCreating(true)}>{t('New task')}</Button>
        </div>
      </div>

      <TaskFiltersBar
        filters={filters}
        assignees={assignees}
        tags={tagList}
        onChange={(changes) => setParams(applyTaskFilters(params, changes))}
      />

      {tasks.isPending ? (
        <LoadingState label={t('Loading tasks')} />
      ) : tasks.isError ? (
        <ErrorState
          error={tasks.error}
          title={t('Could not load tasks')}
          onRetry={() => void tasks.refetch()}
        />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters(filters)
              ? t('No tasks match the filters')
              : t('No tasks yet')
          }
          description={
            hasActiveFilters(filters)
              ? t('Try changing or clearing the filters.')
              : t('Create the first task of this project.')
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
                {t('Clear filters')}
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>{t('New task')}</Button>
            )
          }
        />
      ) : view === 'board' ? (
        <>
          <TaskBoard tasks={tasks.data.items} />
          {tasks.data.meta.total > tasks.data.items.length && (
            <p className="text-sm text-muted-foreground">
              {t(
                'Showing the first {{shown}} of {{total}} tasks. Use the filters to narrow the board.',
                {
                  shown: tasks.data.items.length,
                  total: tasks.data.meta.total,
                },
              )}
            </p>
          )}
        </>
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
