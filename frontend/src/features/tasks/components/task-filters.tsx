import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SORT_OPTIONS, STATUS_LABELS, TASK_STATUSES } from '../constants';
import type { AssigneeOption, Tag, TaskFilters, TaskStatus } from '../types';

interface TaskFiltersProps {
  filters: TaskFilters;
  onChange: (changes: Partial<TaskFilters>) => void;
  assignees: AssigneeOption[];
  tags: Tag[];
}

const toNumber = (value: string) => (value ? Number(value) : undefined);

/** Controls above the list. The state lives in the URL, so every change goes up through `onChange`. */
export function TaskFiltersBar({
  filters,
  onChange,
  assignees,
  tags,
}: TaskFiltersProps) {
  const { t } = useTranslation();
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search');
    const search = typeof value === 'string' ? value.trim() : '';
    // A new search shows the best matches first; clearing it returns to the default order.
    onChange({
      search: search || undefined,
      ...(search
        ? { sortBy: 'relevance', order: 'desc' }
        : filters.sortBy === 'relevance'
          ? { sortBy: 'createdAt', order: 'desc' }
          : {}),
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        role="search"
        onSubmit={submitSearch}
        // The key resets the uncontrolled input when the URL changes (back button, clear).
        key={filters.search ?? ''}
        className="flex gap-2"
      >
        <Input
          name="search"
          type="search"
          aria-label={t('Search tasks')}
          placeholder={t('Search tasks')}
          defaultValue={filters.search ?? ''}
          className="w-56"
        />
        <Button type="submit" variant="outline">
          {t('Search')}
        </Button>
      </form>

      <div className="space-y-1">
        <Label htmlFor="filter-status">{t('Status')}</Label>
        <NativeSelect
          id="filter-status"
          value={filters.status ?? ''}
          onChange={(event) =>
            onChange({
              status: (event.target.value || undefined) as
                TaskStatus | undefined,
            })
          }
        >
          <option value="">{t('All statuses')}</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(STATUS_LABELS[status])}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-assignee">{t('Assignee')}</Label>
        <NativeSelect
          id="filter-assignee"
          value={filters.assigneeId ?? ''}
          onChange={(event) =>
            onChange({ assigneeId: toNumber(event.target.value) })
          }
        >
          <option value="">{t('Anyone')}</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-tag">{t('Tag')}</Label>
        <NativeSelect
          id="filter-tag"
          value={filters.tagId ?? ''}
          onChange={(event) =>
            onChange({ tagId: toNumber(event.target.value) })
          }
        >
          <option value="">{t('Any tag')}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-sort">{t('Sort by')}</Label>
        <NativeSelect
          id="filter-sort"
          value={`${filters.sortBy}:${filters.order}`}
          onChange={(event) => {
            const option = SORT_OPTIONS.find(
              (item) => item.value === event.target.value,
            );
            if (option)
              onChange({ sortBy: option.sortBy, order: option.order });
          }}
        >
          {SORT_OPTIONS.filter(
            (option) => option.sortBy !== 'relevance' || filters.search,
          ).map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
