import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFieldProps {
  /** Both the accessible name and the placeholder, e.g. "Search tasks". */
  label: string;
  defaultValue: string;
  /** Called with the trimmed text when the form is submitted; empty text means "clear the search". */
  onSearch: (value: string) => void;
  className?: string;
}

/**
 * A search box with its button. It is uncontrolled: the page puts `key={currentSearch}` on it so that it follows
 * the URL (back button, clear) without effects.
 */
export function SearchField({
  label,
  defaultValue,
  onSearch,
  className,
}: SearchFieldProps) {
  const { t } = useTranslation();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search');
    onSearch(typeof value === 'string' ? value.trim() : '');
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn('flex gap-2', className)}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          name="search"
          type="search"
          aria-label={label}
          placeholder={label}
          defaultValue={defaultValue}
          className="pl-9"
        />
      </div>
      <Button type="submit" variant="outline" className="h-10">
        {t('Search')}
      </Button>
    </form>
  );
}
