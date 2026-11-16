import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { detectLanguage } from './language';
import { uk } from './uk';

/**
 * The texts of the interface are their own keys: `t('Sign in')`. English needs no dictionary (a missing
 * key is shown as it is), Ukrainian lives in uk.ts. Only plurals have real keys (`tasks_count`), because
 * the number decides the form of the word. A test checks that every key used in the code is translated.
 */
void i18n.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: 'en',
  resources: { en: { translation: en }, uk: { translation: uk } },
  // The keys are sentences: they contain dots and colons.
  keySeparator: false,
  nsSeparator: false,
  // React escapes what it renders.
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Screen readers and the browser's spell checker go by the language of the page.
const setPageLanguage = (language: string) => {
  document.documentElement.lang = language;
};
setPageLanguage(i18n.language);
i18n.on('languageChanged', setPageLanguage);

export default i18n;
