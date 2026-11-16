import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { TextField } from '@/components/form/text-field';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api-client';
import { useCreateProject, useUpdateProject } from '../api/project-mutations';
import type { Project } from '../types';

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(100, 'Use at most 100 characters'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters'),
});

type ProjectValues = z.infer<typeof projectSchema>;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; without it the dialog creates a project. */
  project?: Project;
  onSaved?: (project: Project) => void;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {project
              ? 'Change the name or the description of the project.'
              : 'Projects group tasks that belong together.'}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from the current values. */}
        <ProjectForm
          project={project}
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            onOpenChange(false);
            onSaved?.(saved);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ProjectFormProps {
  project?: Project;
  onCancel: () => void;
  onSaved: (project: Project) => void;
}

function ProjectForm({ project, onCancel, onSaved }: ProjectFormProps) {
  const create = useCreateProject();
  const update = useUpdateProject(project?.id ?? 0);
  const mutation = project ? update : create;

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
    },
  });

  const submit = form.handleSubmit((values) =>
    mutation.mutate(values, { onSuccess: onSaved }),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FieldGroup>
        <TextField
          control={form.control}
          name="name"
          label="Name"
          autoComplete="off"
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                {...field}
                id="description"
                rows={4}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(mutation.error)}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner className="text-current" />}
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </DialogFooter>
    </form>
  );
}
