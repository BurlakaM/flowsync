import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Project } from '../types';
import { ProjectImage } from './project-image';

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Card className="relative h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <ProjectImage project={project} className="mb-2" />
              <CardTitle className="flex items-start justify-between gap-2">
                {/* The stretched link makes the whole card clickable with one real link. */}
                <Link
                  to={`/projects/${project.id}`}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {project.name}
                </Link>
                {project.myRole === 'OWNER' && <Badge>{t('Owner')}</Badge>}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {project.description || t('No description')}
              </CardDescription>
              <p className="pt-2 text-sm text-muted-foreground">
                {t('tasks_count', { count: project.tasksCount })}
              </p>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
