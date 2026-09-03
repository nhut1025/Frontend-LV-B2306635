import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { ingredientsApi } from '../api/ingredients';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';

export default function ProfilePage() {
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [ingredients, setIngredients] = useState([]);
  const [excludedIds, setExcludedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const [profileRes, ingredientsRes, excludedRes] = await Promise.all([
          usersApi.getProfile(),
          ingredientsApi.list(),
          usersApi.getExcludedIngredients(),
        ]);
        const user = profileRes.data.user;
        setForm({ full_name: user.full_name || '', phone: user.phone || '' });
        setIngredients(ingredientsRes.data.ingredients);
        setExcludedIds(excludedRes.data.excluded_ingredients.map((ingredient) => ingredient.id));
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
      await usersApi.setExcludedIngredients(excludedIds);
      setMessage('Đã cập nhật hồ sơ và nguyên liệu không dùng.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Hồ sơ cá nhân</h1>
        <p className="text-sm text-slate-500">Cập nhật thông tin và nguyên liệu bạn không muốn dùng</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải hồ sơ...</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {error && <Alert>{error}</Alert>}
          {message && <Alert type="success">{message}</Alert>}

          <section className="card space-y-4">
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
          </section>

          <section className="card">
            <h2 className="font-display text-base font-semibold text-ink">Nguyên liệu không dùng</h2>
            <p className="mt-1 text-sm text-slate-500">Các món chứa nguyên liệu bạn muốn tránh sẽ được đánh dấu cảnh báo.</p>
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
          </section>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>
      )}
    </Layout>
  );
}
