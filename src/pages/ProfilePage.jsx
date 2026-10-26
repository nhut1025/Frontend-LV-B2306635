import { useEffect, useState } from 'react';
import { CalendarDays, Camera, LockKeyhole, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { ingredientsApi } from '../api/ingredients';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  customer: 'Khách hàng',
  phuc_vu: 'Phục vụ',
  thu_ngan: 'Thu ngân',
  kitchen: 'Bếp',
  manager: 'Quản lý',
};
function formatDate(value, withTime = false) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

export default function ProfilePage() {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [profile, setProfile] = useState(null);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [excludedIds, setExcludedIds] = useState([]);
  const [reservationSummary, setReservationSummary] = useState(null);
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

  useEffect(() => {
    async function loadProfile() {
      try {
        const profileRes = await usersApi.getProfile();
        const user = profileRes.data.user;
        setProfile(user);
        setForm({ full_name: user.full_name || '', phone: user.phone || '' });
        updateUser({ full_name: user.full_name, avatar_url: user.avatar_url });

        if (user.role === 'customer') {
          const [ingredientsRes, excludedRes, summaryRes] = await Promise.all([
            ingredientsApi.list(),
            usersApi.getExcludedIngredients(),
            usersApi.getReservationSummary(),
          ]);
          setIngredients(ingredientsRes.data.ingredients);
          setExcludedIds(excludedRes.data.excluded_ingredients.map((ingredient) => ingredient.id));
          setReservationSummary(summaryRes.data.summary);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  function toggleExcluded(id) {
    setExcludedIds((current) => current.includes(id)
      ? current.filter((ingredientId) => ingredientId !== id)
      : [...current, id]);
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
      setMessage('Đã cập nhật hồ sơ.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleExcludedIngredientsSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await usersApi.setExcludedIngredients(excludedIds);
      setMessage('Đã cập nhật danh sách nguyên liệu không dùng.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e) {
    e.preventDefault();
    if (!avatarFile) {
      setError('Vui lòng chọn ảnh đại diện.');
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
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Mật khẩu mới nhập lại không khớp.');
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

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Hồ sơ cá nhân</h1>
        <p className="text-sm text-slate-500">Quản lý thông tin và cài đặt tài khoản của bạn</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải hồ sơ...</p>
      ) : (
        <div className="max-w-2xl space-y-6">
          {error && <Alert>{error}</Alert>}
          {message && <Alert type="success">{message}</Alert>}

          <section className="card space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">Ảnh đại diện</h2>
            <div className="flex flex-wrap items-center gap-4">
              {profile?.avatar_url ? (
                <button
                  type="button"
                  onClick={() => setViewingAvatar(true)}
                  aria-label="Xem ảnh đại diện"
                  title="Bấm để xem ảnh đại diện"
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-basil-500 focus:ring-offset-2"
                >
                  <img
                    src={profile.avatar_url}
                    alt="Ảnh đại diện"
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
                  {uploadingAvatar ? 'Đang tải lên...' : 'Tải ảnh lên'}
                </button>
                <p className="w-full text-xs text-slate-400">JPG, PNG, WEBP hoặc GIF; tối đa 50 MB.</p>
              </form>
            </div>
          </section>
          {viewingAvatar && profile?.avatar_url && (
            <Modal title="Ảnh đại diện" onClose={() => setViewingAvatar(false)} widthClass="max-w-4xl">
              <img
                src={profile.avatar_url}
                alt="Ảnh đại diện kích thước lớn"
                className="mx-auto max-h-[75dvh] max-w-full rounded-lg object-contain"
              />
            </Modal>
          )}

          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">Thông tin cá nhân</h2>
            <div>
              <label className="field-label" htmlFor="full_name">Họ tên</label>
              <input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">Số điện thoại</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                className="field-input"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </form>

          <section className="card space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">Thông tin tài khoản</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="mt-1 break-all text-sm font-medium text-ink">{profile?.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Ngày tham gia</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{formatDate(profile?.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Xác thực email</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {profile?.is_verified ? 'Đã xác thực' : 'Chưa xác thực'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phương thức đăng nhập</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {profile?.is_google_account ? 'Google' : 'Email và mật khẩu'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Vai trò</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{ROLE_LABELS[profile?.role] || profile?.role || '—'}</dd>
              </div>
            </dl>
          </section>

          {profile?.role === 'customer' && (
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Hoạt động đặt bàn</h2>
                  <p className="mt-1 text-sm text-slate-500">Tổng quan các lần bạn đã đặt bàn.</p>
                </div>
                <Link to="/my-reservations" className="btn-secondary">
                  <CalendarDays size={16} />
                  Đặt bàn của tôi
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">Tổng số lần đặt</dt>
                  <dd className="mt-1 text-2xl font-semibold text-ink">{reservationSummary?.reservation_count ?? 0}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">Lần đặt gần nhất</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {formatDate(reservationSummary?.last_reservation_at, true)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {profile?.role === 'customer' && (
            <section className="card">
              <h2 className="font-display text-base font-semibold text-ink">Nguyên liệu không dùng</h2>
              <p className="mt-1 text-sm text-slate-500">Các món chứa nguyên liệu bạn muốn tránh sẽ được đánh dấu cảnh báo.</p>
              <form onSubmit={handleExcludedIngredientsSubmit}>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ingredients.map((ingredient) => (
                    <label key={ingredient.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={excludedIds.includes(ingredient.id)}
                        onChange={() => toggleExcluded(ingredient.id)}
                        className="h-4 w-4 rounded border-slate-300 text-basil-500 focus:ring-basil-500"
                      />
                      {ingredient.name}
                    </label>
                  ))}
                </div>
                <button type="submit" disabled={saving} className="btn-primary mt-4">
                  {saving ? 'Đang lưu...' : 'Lưu nguyên liệu không dùng'}
                </button>
              </form>
            </section>
          )}

          {!profile?.is_google_account && (
            <section className="card">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                <LockKeyhole size={18} />
                Đổi mật khẩu
              </h2>
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
                <div>
                  <label className="field-label" htmlFor="current_password">Mật khẩu hiện tại</label>
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
                  <label className="field-label" htmlFor="new_password">Mật khẩu mới</label>
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
                  <label className="field-label" htmlFor="confirm_password">Nhập lại mật khẩu mới</label>
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
                  {changingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </button>
              </form>
            </section>
          )}

        </div>
      )}
    </Layout>
  );
}
