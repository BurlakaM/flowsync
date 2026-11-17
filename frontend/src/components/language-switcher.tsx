import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OptionSelect } from '@/components/ui/option-select';
import {
  isLanguage,
  LANGUAGES,
  saveLanguage,
  type LanguageCode,
} from '@/i18n/language';

/** Switches the language of the interface at once and remembers the choice. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <OptionSelect
      variant="pill"
      compact
      align="end"
      aria-label={t('Language')}
      value={i18n.resolvedLanguage ?? ''}
      prefix={<Globe className="size-4" />}
      className="h-8 border-transparent bg-transparent shadow-none hover:bg-accent/60 dark:bg-transparent"
      options={LANGUAGES.map((language) => ({
        value: language.code,
        label: language.label,
      }))}
      onValueChange={(language) => {
        if (!isLanguage(language)) return;
        saveLanguage(language);
        void i18n.changeLanguage(language satisfies LanguageCode);
      }}
    />
  );
}
