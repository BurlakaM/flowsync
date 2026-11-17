import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OptionSelect } from '@/components/ui/option-select';
import { useTheme } from '@/hooks/use-theme';
import { isThemePreference } from '@/lib/theme';

/** Light, dark, or whatever the system uses; shown as one glyph so it takes no room in the header. */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { preference, choose } = useTheme();

  return (
    <OptionSelect
      variant="icon"
      align="end"
      aria-label={t('Theme')}
      value={preference}
      options={[
        { value: 'light', label: t('Light'), icon: <Sun /> },
        { value: 'dark', label: t('Dark'), icon: <Moon /> },
        { value: 'system', label: t('System'), icon: <Monitor /> },
      ]}
      onValueChange={(value) => {
        if (isThemePreference(value)) choose(value);
      }}
    />
  );
}
