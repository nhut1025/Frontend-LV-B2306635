import { useCustomerTranslation } from '../i18n/useCustomerTranslation';

export default function LanguageSwitcher({ className = '' }) {
  const { t, language, i18n } = useCustomerTranslation();
  const label = t(`navigation.switchTo${language === 'vi' ? 'English' : 'Vietnamese'}`);

  function switchLanguage() {
    const nextLanguage = language === 'vi' ? 'en' : 'vi';
    localStorage.setItem('language', nextLanguage);
    i18n.changeLanguage(nextLanguage);
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 md:justify-start md:px-3.5 ${className}`}
    >
      <span className="w-6 text-center font-semibold">{language.toUpperCase()}</span>
      <span className="hidden md:inline">{language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
    </button>
  );
}
