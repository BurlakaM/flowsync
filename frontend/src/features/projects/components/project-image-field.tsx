import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { getErrorMessage } from '@/lib/api-client';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  useRemoveProjectImage,
  useUploadProjectImage,
} from '../api/project-image';
import type { Project } from '../types';
import { ProjectImage } from './project-image';

interface ProjectImageFieldProps {
  project: Project;
}

/**
 * Picks, uploads and removes the picture of a project. A picture is saved as soon as it is chosen,
 * separately from the name and the description, because it travels as a file and not as JSON.
 */
export function ProjectImageField({ project }: ProjectImageFieldProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadProjectImage(project.id);
  const remove = useRemoveProjectImage(project.id);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again after an error.
    event.target.value = '';
    if (!file) return;

    // The server checks everything again; this only saves a round trip with an obvious answer.
    if (!IMAGE_TYPES.includes(file.type)) {
      setProblem(t('Choose a PNG, JPEG or WebP image.'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setProblem(t('The picture is larger than 2 MB.'));
      return;
    }
    setProblem(null);
    upload.mutate(file);
  };

  const busy = upload.isPending || remove.isPending;
  const error =
    problem ??
    (upload.isError ? getErrorMessage(upload.error) : null) ??
    (remove.isError ? getErrorMessage(remove.error) : null);

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor="project-image">{t('Picture')}</FieldLabel>
      <div className="flex items-center gap-3">
        <ProjectImage project={project} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id="project-image"
            type="file"
            accept={IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={choose}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {upload.isPending && <Spinner className="text-current" />}
            {project.hasImage ? t('Change picture') : t('Choose a picture')}
          </Button>
          {project.hasImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setProblem(null);
                remove.mutate();
              }}
            >
              {t('Remove picture')}
            </Button>
          )}
        </div>
      </div>
      <FieldDescription>{t('PNG, JPEG or WebP, up to 2 MB.')}</FieldDescription>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
