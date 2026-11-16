import { useTranslation } from 'react-i18next';
import { NativeSelect } from '@/components/ui/native-select';
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
    <NativeSelect
      aria-label={t('Language')}
      value={i18n.resolvedLanguage}
      className="h-8 w-auto"
      onChange={(event) => {
        const language: unknown = event.target.value;
        if (!isLanguage(language)) return;
        saveLanguage(language);
        void i18n.changeLanguage(language satisfies LanguageCode);
      }}
    >
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </NativeSelect>
  );
}
