import { ArrowUpRight, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getIdentityColor } from '@/lib/identity';
import { cn } from '@/lib/utils';
import type { Project } from '../types';
import { ProjectImage } from './project-image';

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => (
        <li
          key={project.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          <Card className="group/project relative h-full gap-0 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
            {/* Each project gets a cover of its own, derived from its id: it is easy to find by color. */}
            <div
              aria-hidden="true"
              className={cn(
                'relative h-20 bg-linear-to-br opacity-90 after:absolute after:inset-0 after:bg-[radial-gradient(oklch(1_0_0/0.4)_1px,transparent_1px)] after:bg-size-[14px_14px] after:opacity-60 dark:opacity-70',
                getIdentityColor(project.id).cover,
              )}
            />
            <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
              <ProjectImage
                project={project}
                className="-mt-7 size-14 text-2xl ring-4 ring-card"
              />
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-heading text-lg leading-snug font-semibold">
                    {/* The stretched link makes the whole card clickable with one real link. */}
                    <Link
                      to={`/projects/${project.id}`}
                      className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                    >
                      {project.name}
                    </Link>
                  </h2>
                  {project.myRole === 'OWNER' && <Badge>{t('Owner')}</Badge>}
                </div>
                <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                  {project.description || t('No description')}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ListChecks aria-hidden="true" className="size-4" />
                  {t('tasks_count', { count: project.tasksCount })}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 -translate-x-1 translate-y-1 opacity-0 transition-all group-hover/project:translate-x-0 group-hover/project:translate-y-0 group-hover/project:opacity-100"
                />
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
