import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ProjectFormDialog,
  ProjectList,
  useProjects,
} from '@/features/projects';

const PAGE_SIZE = 12;

export default function ProjectsRoute() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  // Search and page live in the URL: the list can be shared and survives a reload.
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const projects = useProjects({
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search');
    updateParams({
      search: typeof value === 'string' ? value.trim() : null,
      page: null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button onClick={() => setCreating(true)}>New project</Button>
      </div>

      <form
        role="search"
        onSubmit={submitSearch}
        // The key resets the uncontrolled input when the URL changes (back button, clear).
        key={search}
        className="flex max-w-md gap-2"
      >
        <Input
          name="search"
          type="search"
          aria-label="Search projects"
          placeholder="Search projects"
          defaultValue={search}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {projects.isPending ? (
        <LoadingState label="Loading projects" />
      ) : projects.isError ? (
        <ErrorState
          error={projects.error}
          what="projects"
          onRetry={() => void projects.refetch()}
        />
      ) : projects.data.items.length === 0 ? (
        <EmptyState
          title={search ? 'No projects match your search' : 'No projects yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create your first project to start adding tasks.'
          }
          action={
            search ? (
              <Button
                variant="outline"
                onClick={() => updateParams({ search: null, page: null })}
              >
                Clear search
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>New project</Button>
            )
          }
        />
      ) : (
        <>
          <ProjectList projects={projects.data.items} />
          <Pagination
            page={projects.data.meta.page}
            totalPages={projects.data.meta.totalPages}
            onPageChange={(next) =>
              updateParams({ page: next > 1 ? String(next) : null })
            }
          />
        </>
      )}

      <ProjectFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(project) => navigate(`/projects/${project.id}`)}
      />
    </div>
  );
}
