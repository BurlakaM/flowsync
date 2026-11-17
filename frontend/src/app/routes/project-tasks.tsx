import { Columns3, LayoutList, ListChecks, Plus, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useRefreshProjects, type ProjectDetails } from '@/features/projects';
import {
  applyTaskFilters,
  hasActiveFilters,
  parseTaskFilters,
  TaskFiltersBar,
  TaskFormDialog,
  TaskBoard,
  TaskList,
  TaskStatusTabs,
  useProjectTasks,
  useTaskCounts,
  BOARD_PAGE_SIZE,
  useTags,
} from '@/features/tasks';

interface ProjectTasksProps {
  project: ProjectDetails;
}

type View = 'list' | 'board';

/** The tasks of a project: this page composes the tasks feature with the members of the projects feature. */
export function ProjectTasks({ project }: ProjectTasksProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const refreshProjects = useRefreshProjects();
  const { t } = useTranslation();

  // The board shows every status at once, so it loads as many tasks as one request allows and has no pages.
  const view: View = params.get('view') === 'board' ? 'board' : 'list';
  // Filters, sorting and the page live in the URL: the list can be shared and survives a reload.
  const parsed = parseTaskFilters(params);
  // The columns of the board are the statuses, so a status filter set in the list does not apply to it.
  const filters = view === 'board' ? { ...parsed, status: undefined } : parsed;
  const tasks = useProjectTasks(
    project.id,
    filters,
    view === 'board' ? BOARD_PAGE_SIZE : undefined,
  );
  // The numbers on the status tabs follow the other filters, so they match what a click on a tab shows.
  const counts = useTaskCounts(project.id, {
    assigneeId: filters.assigneeId,
    tagId: filters.tagId,
    search: filters.search,
  });
  const setView = (next: View) => {
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
  const filtered = hasActiveFilters(filters);

  return (
    <section aria-labelledby="tasks-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="tasks-heading" className="text-2xl font-semibold">
            {t('Tasks')}
          </h2>
          {view === 'list' && (
            <TaskStatusTabs
              value={filters.status}
              counts={counts}
              onChange={(status) =>
                setParams(applyTaskFilters(params, { status }))
              }
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            aria-label={t('View')}
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: t('List'), icon: <LayoutList /> },
              { value: 'board', label: t('Board'), icon: <Columns3 /> },
            ]}
          />
          <Button onClick={() => setCreating(true)} className="h-10">
            <Plus data-icon="inline-start" />
            {t('New task')}
          </Button>
        </div>
      </div>

      <TaskFiltersBar
        filters={filters}
        assignees={assignees}
        tags={tagList}
        showClear={tasks.data?.items.length !== 0}
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
          icon={filtered ? <SearchX /> : <ListChecks />}
          title={filtered ? t('No tasks match the filters') : t('No tasks yet')}
          description={
            filtered
              ? t('Try changing or clearing the filters.')
              : t('Create the first task of this project.')
          }
          action={
            filtered ? (
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
              <Button onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" />
                {t('New task')}
              </Button>
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
