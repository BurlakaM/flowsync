import { ArrowUpDown, Tag as TagIcon, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SearchField } from '@/components/form/search-field';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import { SORT_OPTIONS } from '../constants';
import type { AssigneeOption, Tag, TaskFilters } from '../types';
import { hasActiveFilters } from '../utils/task-filters';

interface TaskFiltersProps {
  filters: TaskFilters;
  onChange: (changes: Partial<TaskFilters>) => void;
  assignees: AssigneeOption[];
  tags: Tag[];
  /** False while the page shows its own "clear filters" button (an empty result). */
  showClear?: boolean;
}

const toNumber = (value: string) => (value ? Number(value) : undefined);

/** Controls above the list. The state lives in the URL, so every change goes up through `onChange`. */
export function TaskFiltersBar({
  filters,
  onChange,
  assignees,
  tags,
  showClear = true,
}: TaskFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        // The key resets the uncontrolled input when the URL changes (back button, clear).
        key={filters.search ?? ''}
        label={t('Search tasks')}
        defaultValue={filters.search ?? ''}
        className="w-full sm:w-80"
        onSearch={(search) =>
          // A new search shows the best matches first; clearing it returns to the default order.
          onChange({
            search: search || undefined,
            ...(search
              ? { sortBy: 'relevance', order: 'desc' }
              : filters.sortBy === 'relevance'
                ? { sortBy: 'createdAt', order: 'desc' }
                : {}),
          })
        }
      />

      <OptionSelect
        variant="pill"
        tinted
        prefix={<Users className="size-4" />}
        aria-label={t('Assignee')}
        value={filters.assigneeId?.toString() ?? ''}
        onValueChange={(value) => onChange({ assigneeId: toNumber(value) })}
        options={[
          { value: '', label: t('Anyone') },
          ...assignees.map((person) => ({
            value: String(person.id),
            label: person.name,
          })),
        ]}
      />

      <OptionSelect
        variant="pill"
        tinted
        prefix={<TagIcon className="size-4" />}
        aria-label={t('Tag')}
        value={filters.tagId?.toString() ?? ''}
        onValueChange={(value) => onChange({ tagId: toNumber(value) })}
        options={[
          { value: '', label: t('Any tag') },
          ...tags.map((tag) => ({ value: String(tag.id), label: tag.name })),
        ]}
      />

      <OptionSelect
        variant="pill"
        prefix={<ArrowUpDown className="size-4" />}
        aria-label={t('Sort by')}
        value={`${filters.sortBy}:${filters.order}`}
        onValueChange={(value) => {
          const option = SORT_OPTIONS.find((item) => item.value === value);
          if (option) onChange({ sortBy: option.sortBy, order: option.order });
        }}
        options={SORT_OPTIONS.filter(
          (option) => option.sortBy !== 'relevance' || filters.search,
        ).map((option) => ({ value: option.value, label: t(option.label) }))}
      />

      {showClear && hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              status: undefined,
              assigneeId: undefined,
              tagId: undefined,
              search: undefined,
            })
          }
        >
          <X data-icon="inline-start" />
          {t('Clear filters')}
        </Button>
      )}
    </div>
  );
}
