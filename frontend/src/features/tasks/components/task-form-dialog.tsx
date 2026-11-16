import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { TextField } from '@/components/form/text-field';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api-client';
import { useCreateTask, useUpdateTask } from '../api/task-mutations';
import { STATUS_LABELS, TASK_STATUSES } from '../constants';
import type {
  AssigneeOption,
  Tag,
  Task,
  TaskDetails,
  TaskStatus,
} from '../types';

const taskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(200, 'Use at most 200 characters'),
  description: z.string().trim().max(5000, 'Use at most 5000 characters'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  assigneeIds: z.array(z.number()),
  tagIds: z.array(z.number()),
});

type TaskValues = z.infer<typeof taskSchema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  /** Present when editing; without it the dialog creates a task. */
  task?: Task;
  /** People that can be assigned (the members of the project). */
  assignees: AssigneeOption[];
  tags: Tag[];
  onSaved?: (task: TaskDetails) => void;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  projectId,
  task,
  assignees,
  tags,
  onSaved,
}: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {task
              ? 'Change the details of the task.'
              : 'Describe what needs to be done.'}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from the current values. */}
        <TaskForm
          projectId={projectId}
          task={task}
          assignees={assignees}
          tags={tags}
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

interface TaskFormProps {
  projectId: number;
  task?: Task;
  assignees: AssigneeOption[];
  tags: Tag[];
  onCancel: () => void;
  onSaved: (task: TaskDetails) => void;
}

function TaskForm({
  projectId,
  task,
  assignees,
  tags,
  onCancel,
  onSaved,
}: TaskFormProps) {
  const create = useCreateTask(projectId);
  const update = useUpdateTask(task?.id ?? 0);
  const mutation = task ? update : create;

  const form = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: task?.name ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'TODO',
      assigneeIds: task?.assignees.map((user) => user.id) ?? [],
      tagIds: task?.tags.map((tag) => tag.id) ?? [],
    },
  });

  // Someone already assigned stays visible even if they left the project meanwhile.
  const people = [
    ...assignees,
    ...(task?.assignees ?? []).filter(
      (user) => !assignees.some((person) => person.id === user.id),
    ),
  ];

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
              <FieldLabel htmlFor="task-description">Description</FieldLabel>
              <Textarea
                {...field}
                id="task-description"
                rows={4}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="status"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="task-status">Status</FieldLabel>
              <NativeSelect
                id="task-status"
                {...field}
                onChange={(event) =>
                  field.onChange(event.target.value as TaskStatus)
                }
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        />

        <Controller
          name="assigneeIds"
          control={form.control}
          render={({ field }) => (
            <CheckboxGroup
              legend="Assignees"
              emptyText="No one to assign yet."
              idPrefix="assignee"
              options={people.map((person) => ({
                id: person.id,
                label: person.name,
              }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="tagIds"
          control={form.control}
          render={({ field }) => (
            <CheckboxGroup
              legend="Tags"
              emptyText="This project has no tags yet."
              idPrefix="tag"
              options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
              value={field.value}
              onChange={field.onChange}
            />
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
          {task ? 'Save changes' : 'Create task'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface CheckboxGroupProps {
  legend: string;
  emptyText: string;
  idPrefix: string;
  options: { id: number; label: string }[];
  value: number[];
  onChange: (value: number[]) => void;
}

function CheckboxGroup({
  legend,
  emptyText,
  idPrefix,
  options,
  value,
  onChange,
}: CheckboxGroupProps) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map((option) => {
            const id = `${idPrefix}-${option.id}`;
            return (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={value.includes(option.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...value, option.id]
                        : value.filter((item) => item !== option.id),
                    )
                  }
                />
                <Label htmlFor={id} className="font-normal">
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </FieldSet>
  );
}
