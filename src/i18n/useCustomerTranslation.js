import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function useCustomerTranslation(isCustomerFacing = true) {
  const { t, i18n } = useTranslation();
  const language = isCustomerFacing && i18n.resolvedLanguage === 'en' ? 'en' : 'vi';
  const translate = useCallback(
    (key, options) => t(key, { ...options, lng: language }),
    [language, t],
  );

  return {
    t: translate,
    language,
    locale: language === 'en' ? 'en-US' : 'vi-VN',
    i18n,
  };
}
