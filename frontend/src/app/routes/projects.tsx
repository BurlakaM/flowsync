import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SearchField } from '@/components/form/search-field';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
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
  const { t } = useTranslation();

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">{t('Projects')}</h1>
          <p className="text-muted-foreground">
            {t('Everything your team is working on.')}
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          {t('New project')}
        </Button>
      </div>

      <SearchField
        // The key resets the uncontrolled input when the URL changes (back button, clear).
        key={search}
        label={t('Search projects')}
        defaultValue={search}
        onSearch={(value) =>
          updateParams({ search: value || null, page: null })
        }
        className="max-w-md"
      />

      {projects.isPending ? (
        <LoadingState label={t('Loading projects')} />
      ) : projects.isError ? (
        <ErrorState
          error={projects.error}
          title={t('Could not load projects')}
          onRetry={() => void projects.refetch()}
        />
      ) : projects.data.items.length === 0 ? (
        <EmptyState
          title={
            search ? t('No projects match your search') : t('No projects yet')
          }
          description={
            search
              ? t('Try a different search term.')
              : t('Create your first project to start adding tasks.')
          }
          action={
            search ? (
              <Button
                variant="outline"
                onClick={() => updateParams({ search: null, page: null })}
              >
                {t('Clear search')}
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>
                {t('New project')}
              </Button>
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
