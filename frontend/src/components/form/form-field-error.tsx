import type { FieldError as HookFormError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FieldError } from '@/components/ui/field';

/**
 * The validation message of a field. The schemas hold the English sentence, which doubles as the
 * translation key, so the message is translated only here, when it is shown.
 */
export function FormFieldError({ error }: { error?: HookFormError }) {
  const { t } = useTranslation();
  if (!error?.message) return null;
  return <FieldError errors={[{ message: t(error.message) }]} />;
}
