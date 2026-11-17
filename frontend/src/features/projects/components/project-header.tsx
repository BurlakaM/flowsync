import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { getIdentityColor } from '@/lib/identity';
import { cn } from '@/lib/utils';
import type { ProjectDetails } from '../types';
import { ProjectImage } from './project-image';

interface ProjectHeaderProps {
  project: ProjectDetails;
  /** How many tasks are done out of all; the page supplies it, because this feature does not know tasks. */
  progress?: { done: number; total: number };
  /** Buttons for the owner (edit, delete), placed by the page together with their dialogs. */
  actions?: ReactNode;
}

/** The top of a project page: a cover and a picture of its own, the name, the people and how far it has come. */
export function ProjectHeader({
  project,
  progress,
  actions,
}: ProjectHeaderProps) {
  const { t } = useTranslation();
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <header className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border">
      <div
        aria-hidden="true"
        className={cn(
          'relative h-28 bg-linear-to-br opacity-90 after:absolute after:inset-0 after:bg-[radial-gradient(oklch(1_0_0/0.45)_1px,transparent_1px)] after:bg-size-[16px_16px] after:opacity-60 sm:h-36 dark:opacity-70',
          getIdentityColor(project.id).cover,
        )}
      />
      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-4 sm:-mt-12">
          <ProjectImage
            project={project}
            className="size-20 text-3xl ring-4 ring-card sm:size-24 sm:text-4xl"
          />
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>

        <div className="mt-4 space-y-2">
          <h1 className="text-3xl font-semibold sm:text-4xl">{project.name}</h1>
          <p className="max-w-3xl text-muted-foreground">
            {project.description || t('No description')}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Avatar
              name={project.owner.name}
              seed={project.owner.id}
              size="sm"
              decorative
            />
            {t('Owner: {{name}}', { name: project.owner.name })}
          </span>
          <AvatarStack
            max={5}
            people={project.members.map((member) => ({
              id: member.userId,
              name: member.name,
            }))}
          />
          {progress && progress.total > 0 && (
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={t('Progress')}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                className="h-2 w-40 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-brand-gradient transition-[width] duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="tabular-nums">
                {t('{{done}} of {{total}} done', {
                  done: progress.done,
                  total: progress.total,
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
