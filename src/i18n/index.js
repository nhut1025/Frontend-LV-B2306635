import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';

const savedLanguage = localStorage.getItem('language');

function updateDocumentLanguage(language) {
  const resolvedLanguage = language === 'en' ? 'en' : 'vi';
  document.documentElement.lang = resolvedLanguage;
  document.title = i18n.t('metadata.title', { lng: resolvedLanguage });
}

i18n.on('languageChanged', updateDocumentLanguage);
i18n.on('initialized', () => updateDocumentLanguage(i18n.resolvedLanguage));

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: savedLanguage === 'en' ? 'en' : 'vi',
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
