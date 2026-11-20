import { useEffect, useState } from 'react';
import { Ban, CalendarDays, Camera, Heart, Landmark, LockKeyhole, Pencil, Trash2, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { ingredientsApi } from '../api/ingredients';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import { formatDate as formatLocaleDate } from '../i18n/formatters';

function normalizeIngredientName(value) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export default function ProfilePage() {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [profile, setProfile] = useState(null);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientStates, setIngredientStates] = useState({});
  const [savedIngredientStates, setSavedIngredientStates] = useState({});
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [reservationSummary, setReservationSummary] = useState(null);
  const [refundBankAccounts, setRefundBankAccounts] = useState([]);
  const [refundBankAccountForm, setRefundBankAccountForm] = useState({
    bank_code: '',
    account_number: '',
    account_name: '',
    is_default: false,
  });
  const [editingRefundBankAccountId, setEditingRefundBankAccountId] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { t, locale } = useCustomerTranslation(profile?.role === 'customer');

  useEffect(() => {
    async function loadProfile() {
      try {
        const profileRes = await usersApi.getProfile();
        const user = profileRes.data.user;
        setProfile(user);
        setForm({ full_name: user.full_name || '', phone: user.phone || '' });
        updateUser({ full_name: user.full_name, avatar_url: user.avatar_url });

        if (user.role === 'customer') {
          const [ingredientsRes, excludedRes, preferredRes, summaryRes, refundBankAccountsRes] = await Promise.all([
            ingredientsApi.list(),
            usersApi.getExcludedIngredients(),
            usersApi.getPreferredIngredients(),
            usersApi.getReservationSummary(),
            usersApi.listRefundBankAccounts(),
          ]);
          const loadedIngredients = ingredientsRes.data.ingredients;
          const excludedIds = new Set(
            excludedRes.data.excluded_ingredients.map((ingredient) => ingredient.id)
          );
          const preferredIds = new Set(
            preferredRes.data.preferred_ingredients.map((ingredient) => ingredient.id)
          );
          const loadedStates = Object.fromEntries(
            loadedIngredients.map((ingredient) => [
              ingredient.id,
              excludedIds.has(ingredient.id)
                ? 'excluded'
                : preferredIds.has(ingredient.id)
                  ? 'preferred'
                  : 'none',
            ])
          );
          setIngredients(loadedIngredients);
          setIngredientStates(loadedStates);
          setSavedIngredientStates(loadedStates);
          setReservationSummary(summaryRes.data.summary);
          setRefundBankAccounts(refundBankAccountsRes.data.accounts || []);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  function toggleIngredientState(id) {
    setIngredientStates((current) => {
      const currentState = current[id] || 'none';
      const nextState = currentState === 'none'
        ? 'preferred'
        : currentState === 'preferred'
          ? 'excluded'
          : 'none';
      return { ...current, [id]: nextState };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await usersApi.updateProfile(form);
      updateUser({ full_name: form.full_name.trim() });
      setProfile((current) => ({ ...current, full_name: form.full_name.trim(), phone: form.phone || null }));
      setMessage(t('profile.savedProfile'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleIngredientPreferencesSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const statesToSave = { ...ingredientStates };
    const preferredIds = ingredients
      .filter((ingredient) => statesToSave[ingredient.id] === 'preferred')
      .map((ingredient) => ingredient.id);
    const excludedIds = ingredients
      .filter((ingredient) => statesToSave[ingredient.id] === 'excluded')
      .map((ingredient) => ingredient.id);
    try {
      await usersApi.setPreferredIngredients(preferredIds);
      await usersApi.setExcludedIngredients(excludedIds);
      setSavedIngredientStates(statesToSave);
      setMessage(t('profile.savedPreferences'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function resetRefundBankAccountForm(defaultValue = refundBankAccounts.length === 0) {
    setRefundBankAccountForm({
      bank_code: '',
      account_number: '',
      account_name: '',
      is_default: defaultValue,
    });
    setEditingRefundBankAccountId(null);
  }

  function editRefundBankAccount(account) {
    setRefundBankAccountForm({
      bank_code: account.bank_code,
      account_number: account.account_number,
      account_name: account.account_name,
      is_default: Boolean(account.is_default),
    });
    setEditingRefundBankAccountId(account.id);
  }

  async function handleRefundBankAccountSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const request = editingRefundBankAccountId
        ? usersApi.updateRefundBankAccount(editingRefundBankAccountId, refundBankAccountForm)
        : usersApi.createRefundBankAccount(refundBankAccountForm);
      await request;
      const response = await usersApi.listRefundBankAccounts();
      setRefundBankAccounts(response.data.accounts || []);
      resetRefundBankAccountForm();
      setMessage(t('profile.refundAccountSaved'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefundBankAccountDelete(account) {
    if (!confirm(t('profile.refundAccountDeleteConfirm'))) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await usersApi.deleteRefundBankAccount(account.id);
      const response = await usersApi.listRefundBankAccounts();
      const accounts = response.data.accounts || [];
      setRefundBankAccounts(accounts);
      if (editingRefundBankAccountId === account.id) resetRefundBankAccountForm(accounts.length === 0);
      setMessage(t('profile.refundAccountDeleted'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefundBankAccountDefault(account) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await usersApi.updateRefundBankAccount(account.id, {
        bank_code: account.bank_code,
        account_number: account.account_number,
        account_name: account.account_name,
        is_default: true,
      });
      const response = await usersApi.listRefundBankAccounts();
      setRefundBankAccounts(response.data.accounts || []);
      setMessage(t('profile.refundAccountDefaultSaved'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e) {
    e.preventDefault();
    if (!avatarFile) {
      setError(t('profile.chooseAvatar'));
      return;
    }

    setUploadingAvatar(true);
    setError('');
    setMessage('');
    try {
      const data = new FormData();
      data.append('avatar', avatarFile);
      const response = await usersApi.uploadAvatar(data);
      const avatarUrl = response.data.avatar_url;
      setProfile((current) => ({ ...current, avatar_url: avatarUrl }));
      updateUser({ avatar_url: avatarUrl });
      setAvatarFile(null);
      e.target.reset();
      setMessage(t('profile.savedAvatar'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError(t('profile.passwordMismatch'));
      return;
    }

    setChangingPassword(true);
    setError('');
    setMessage('');
    try {
      const { current_password, new_password } = passwordForm;
      const response = await usersApi.changePassword({ current_password, new_password });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setMessage(response.data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  const normalizedIngredientSearch = normalizeIngredientName(ingredientSearch.trim());
  const filteredIngredients = ingredients.filter((ingredient) =>
    normalizeIngredientName(ingredient.name).includes(normalizedIngredientSearch)
  );
  const preferredCount = ingredients.filter(
    (ingredient) => ingredientStates[ingredient.id] === 'preferred'
  ).length;
  const excludedCount = ingredients.filter(
    (ingredient) => ingredientStates[ingredient.id] === 'excluded'
  ).length;
  const hasIngredientChanges = ingredients.some(
    (ingredient) => ingredientStates[ingredient.id] !== savedIngredientStates[ingredient.id]
  );

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">{t('profile.title')}</h1>
        <p className="text-sm text-slate-500">{t('profile.description')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t('profile.loading')}</p>
      ) : (
        <div className="max-w-2xl space-y-6">
          {error && <Alert>{error}</Alert>}
          {message && <Alert type="success">{message}</Alert>}

          <section className="card space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">{t('profile.avatar')}</h2>
            <div className="flex flex-wrap items-center gap-4">
              {profile?.avatar_url ? (
                <button
                  type="button"
                  onClick={() => setViewingAvatar(true)}
                  aria-label={t('profile.viewAvatar')}
                  title={t('profile.viewAvatarTitle')}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-basil-500 focus:ring-offset-2"
                >
                  <img
                    src={profile.avatar_url}
                    alt={t('profile.avatar')}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-basil-50 text-basil-600">
                  <UserRound size={32} />
                </div>
              )}
              <form onSubmit={handleAvatarUpload} className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-slate-200 sm:w-auto"
                />
                <button type="submit" disabled={uploadingAvatar} className="btn-primary">
                  <Camera size={16} />
                  {uploadingAvatar ? t('profile.uploading') : t('profile.upload')}
                </button>
                <p className="w-full text-xs text-slate-400">{t('profile.imageRules')}</p>
              </form>
            </div>
          </section>
          {viewingAvatar && profile?.avatar_url && (
            <Modal title={t('profile.avatar')} onClose={() => setViewingAvatar(false)} widthClass="max-w-4xl">
              <img
                src={profile.avatar_url}
                alt={t('profile.largeAvatar')}
                className="mx-auto max-h-[75dvh] max-w-full rounded-lg object-contain"
              />
            </Modal>
          )}

          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">{t('profile.personalInfo')}</h2>
            <div>
              <label className="field-label" htmlFor="full_name">{t('profile.fullName')}</label>
              <input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">{t('profile.phone')}</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                className="field-input"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('profile.saving') : t('profile.saveInfo')}
            </button>
          </form>

          {profile?.role === 'customer' && (
            <section className="card space-y-4">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                  <Landmark size={18} />
                  {t('profile.refundAccountsTitle')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{t('profile.refundAccountsDescription')}</p>
              </div>
              <div className="space-y-3">
                {refundBankAccounts.map((account) => (
                  <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {account.bank_code}
                        {Boolean(account.is_default) && (
                          <span className="ml-2 rounded-full bg-basil-50 px-2 py-1 text-xs font-medium text-basil-700">
                            {t('profile.refundAccountDefault')}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{account.account_number} · {account.account_name}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!Boolean(account.is_default) && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRefundBankAccountDefault(account)}
                          className="btn-secondary"
                        >
                          {t('profile.refundAccountSetDefault')}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => editRefundBankAccount(account)}
                        className="btn-secondary"
                        aria-label={t('profile.refundAccountEdit')}
                      >
                        <Pencil size={15} />
                        {t('profile.refundAccountEdit')}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRefundBankAccountDelete(account)}
                        className="btn-secondary text-clay-600"
                        aria-label={t('profile.refundAccountDelete')}
                      >
                        <Trash2 size={15} />
                        {t('profile.refundAccountDelete')}
                      </button>
                    </div>
                  </article>
                ))}
                {refundBankAccounts.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    {t('profile.refundAccountsEmpty')}
                  </p>
                )}
              </div>
              <form onSubmit={handleRefundBankAccountSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4">
                <h3 className="font-medium text-ink">
                  {t(editingRefundBankAccountId ? 'profile.refundAccountEditTitle' : 'profile.refundAccountAddTitle')}
                </h3>
                <div>
                  <label className="field-label" htmlFor="refund_bank_code">{t('profile.refundBank')}</label>
                  <input
                    id="refund_bank_code"
                    required
                    maxLength={20}
                    value={refundBankAccountForm.bank_code}
                    onChange={(event) => setRefundBankAccountForm((current) => ({ ...current, bank_code: event.target.value }))}
                    className="field-input"
                    placeholder={t('profile.refundBankPlaceholder')}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="refund_account_number">{t('profile.refundAccountNumber')}</label>
                  <input
                    id="refund_account_number"
                    required
                    maxLength={50}
                    value={refundBankAccountForm.account_number}
                    onChange={(event) => setRefundBankAccountForm((current) => ({ ...current, account_number: event.target.value }))}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="refund_account_name">{t('profile.refundAccountName')}</label>
                  <input
                    id="refund_account_name"
                    required
                    maxLength={100}
                    value={refundBankAccountForm.account_name}
                    onChange={(event) => setRefundBankAccountForm((current) => ({ ...current, account_name: event.target.value }))}
                    className="field-input"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={refundBankAccountForm.is_default}
                    onChange={(event) => setRefundBankAccountForm((current) => ({ ...current, is_default: event.target.checked }))}
                    className="rounded border-slate-300 text-basil-600 focus:ring-basil-500"
                  />
                  {t('profile.refundAccountMakeDefault')}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? t('profile.saving') : t(editingRefundBankAccountId ? 'profile.refundAccountUpdate' : 'profile.refundAccountAdd')}
                  </button>
                  {editingRefundBankAccountId && (
                    <button type="button" onClick={resetRefundBankAccountForm} className="btn-secondary">
                      {t('profile.refundAccountCancelEdit')}
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {profile?.role === 'customer' && (
            <section className="card space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">{t('profile.dietaryPreferences')}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('profile.dietaryDescription')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="rounded-lg bg-basil-50 px-3 py-2 text-basil-800">
                  ❤️ {t('profile.preferredLegend')}
                </div>
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
                  🚫 {t('profile.excludedLegend')}
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                  {t('profile.clickToChange')}
                </div>
              </div>
              <form onSubmit={handleIngredientPreferencesSubmit} className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="ingredient_search">{t('profile.ingredientSearch')}</label>
                  <input
                    id="ingredient_search"
                    type="search"
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    placeholder={t('profile.ingredientPlaceholder')}
                    className="field-input"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredIngredients.map((ingredient) => {
                    const state = ingredientStates[ingredient.id] || 'none';
                    const stateLabel = state === 'preferred'
                      ? t('profile.preferred')
                      : state === 'excluded'
                        ? t('profile.excluded')
                        : t('profile.unselected');
                    const stateClass = state === 'preferred'
                      ? 'border-basil-200 bg-basil-50 text-basil-800 hover:bg-basil-100'
                      : state === 'excluded'
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';
                    const statusDescription = t('profile.ingredientStateLabel', { name: ingredient.name, state: stateLabel });

                    return (
                      <button
                        key={ingredient.id}
                        type="button"
                        onClick={() => toggleIngredientState(ingredient.id)}
                        aria-label={statusDescription}
                        title={statusDescription}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-basil-500 focus-visible:ring-offset-2 ${stateClass}`}
                      >
                        {state === 'preferred' && <Heart size={14} aria-hidden="true" />}
                        {state === 'excluded' && <Ban size={14} aria-hidden="true" />}
                        <span className={state === 'excluded' ? 'line-through' : ''}>
                          {ingredient.name}
                        </span>
                      </button>
                    );
                  })}
                  {filteredIngredients.length === 0 && (
                    <p className="text-sm text-slate-500">
                      {ingredients.length === 0
                        ? t('profile.noIngredients')
                        : t('profile.noIngredientMatches')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    {t('profile.preferenceCounts', {
                      preferred: new Intl.NumberFormat(locale).format(preferredCount),
                      excluded: new Intl.NumberFormat(locale).format(excludedCount),
                    })}
                  </p>
                  <button
                    type="submit"
                    disabled={saving || !hasIngredientChanges}
                    className="btn-primary"
                  >
                    {saving ? t('profile.savingPreferences') : t('profile.savePreferences')}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="card space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">{t('profile.accountInfo')}</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t('profile.email')}</dt>
                <dd className="mt-1 break-all text-sm font-medium text-ink">{profile?.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('profile.joined')}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{profile?.created_at
                  ? formatLocaleDate(profile.created_at, locale)
                  : t('profile.noData')}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('profile.emailVerification')}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {t(profile?.is_verified ? 'profile.verified' : 'profile.notVerified')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('profile.loginMethod')}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {t(profile?.is_google_account ? 'profile.google' : 'profile.emailAndPassword')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('profile.role')}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {profile?.role ? t(`profile.roles.${profile.role}`, { defaultValue: profile.role }) : '—'}
                </dd>
              </div>
            </dl>
          </section>

          {profile?.role === 'customer' && (
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">{t('profile.reservationActivity')}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t('profile.reservationSummary')}</p>
                </div>
                <Link to="/my-reservations" className="btn-secondary">
                  <CalendarDays size={16} />
                  {t('profile.myReservations')}
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">{t('profile.reservationCount')}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-ink">{reservationSummary?.reservation_count ?? 0}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">{t('profile.lastReservation')}</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {reservationSummary?.last_reservation_at
                      ? formatLocaleDate(reservationSummary.last_reservation_at, locale, { dateStyle: 'medium', timeStyle: 'short' })
                      : t('profile.noData')}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {!profile?.is_google_account && (
            <section className="card">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                <LockKeyhole size={18} />
                {t('profile.changePassword')}
              </h2>
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
                <div>
                  <label className="field-label" htmlFor="current_password">{t('profile.currentPassword')}</label>
                  <input
                    id="current_password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, current_password: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="new_password">{t('profile.newPassword')}</label>
                  <input
                    id="new_password"
                    type="password"
                    required
                    minLength={6}
                    maxLength={72}
                    autoComplete="new-password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, new_password: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="confirm_password">{t('profile.confirmPassword')}</label>
                  <input
                    id="confirm_password"
                    type="password"
                    required
                    minLength={6}
                    maxLength={72}
                    autoComplete="new-password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, confirm_password: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <button type="submit" disabled={changingPassword} className="btn-primary">
                  {changingPassword ? t('profile.changingPassword') : t('profile.changePasswordButton')}
                </button>
              </form>
            </section>
          )}

        </div>
      )}
    </Layout>
  );
}
