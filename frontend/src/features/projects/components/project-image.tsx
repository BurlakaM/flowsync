import { useTranslation } from 'react-i18next';
import { getIdentityColor } from '@/lib/identity';
import { cn } from '@/lib/utils';
import { useProjectImage } from '../api/project-image';
import type { Project } from '../types';

interface ProjectImageProps {
  project: Pick<Project, 'id' | 'name' | 'hasImage' | 'updatedAt'>;
  className?: string;
}

/** The picture of a project, or its first letter on a gradient of its own while there is none (or it is loading). */
export function ProjectImage({ project, className }: ProjectImageProps) {
  const { t } = useTranslation();
  const image = useProjectImage(project);
  const url = image.data;
  const box = cn(
    'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-semibold shadow-sm ring-1 ring-black/5',
    className,
  );

  if (url) {
    return (
      <img
        src={url}
        alt={t('Picture of the project {{name}}', { name: project.name })}
        className={cn(box, 'object-cover')}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        'bg-linear-to-br font-heading text-white',
        getIdentityColor(project.id).avatar,
      )}
    >
      {project.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
