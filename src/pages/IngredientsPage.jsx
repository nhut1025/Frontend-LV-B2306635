import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Salad, Trash2, X } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { ingredientsApi } from '../api/ingredients';
import { getErrorMessage } from '../api/client';

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadIngredients() {
    setLoading(true);
    setError('');
    try {
      const response = await ingredientsApi.list();
      setIngredients(response.data.ingredients || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIngredients();
  }, []);

  function resetForm() {
    setName('');
    setEditingId(null);
  }

  function startEditing(ingredient) {
    setEditingId(ingredient.id);
    setName(ingredient.name);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingId === null) {
        await ingredientsApi.create(trimmedName);
        setSuccess(`Đã thêm nguyên liệu "${trimmedName}".`);
      } else {
        await ingredientsApi.update(editingId, trimmedName);
        setSuccess(`Đã cập nhật nguyên liệu "${trimmedName}".`);
      }
      resetForm();
      await loadIngredients();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ingredient) {
    if (!window.confirm(`Xóa nguyên liệu "${ingredient.name}"? Liên kết nguyên liệu này với món ăn và hồ sơ khách hàng cũng sẽ bị xóa.`)) return;
    setDeletingId(ingredient.id);
    setError('');
    setSuccess('');
    try {
      await ingredientsApi.remove(ingredient.id);
      setSuccess(`Đã xóa nguyên liệu "${ingredient.name}".`);
      if (editingId === ingredient.id) resetForm();
      await loadIngredients();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Quản lý nguyên liệu món ăn</h1>
        <p className="text-sm text-slate-500">Nguyên liệu tại đây có thể được gắn vào món ăn và dùng cho cảnh báo nguyên liệu cần tránh.</p>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

      <form onSubmit={handleSubmit} className="card mb-5">
        <label htmlFor="ingredient-name" className="field-label">
          {editingId === null ? 'Tên nguyên liệu mới' : 'Đổi tên nguyên liệu'}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="ingredient-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            className="field-input flex-1"
            placeholder="Ví dụ: Thịt bò"
          />
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : editingId === null ? <Plus size={16} /> : <Check size={16} />}
            {editingId === null ? 'Thêm nguyên liệu' : 'Lưu thay đổi'}
          </button>
          {editingId !== null && (
            <button type="button" onClick={resetForm} disabled={saving} className="btn-secondary">
              <X size={16} /> Hủy
            </button>
          )}
        </div>
      </form>

      <section className="card">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <Salad size={18} /> Nguyên liệu hiện có
          <span className="font-sans text-sm font-normal text-slate-400">{ingredients.length}</span>
        </h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
        ) : ingredients.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có nguyên liệu nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ingredients.map((ingredient) => (
              <li key={ingredient.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p className="font-medium text-ink">{ingredient.name}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEditing(ingredient)} className="btn-secondary px-3 py-2" aria-label={`Sửa ${ingredient.name}`}>
                    <Pencil size={15} /> Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ingredient)}
                    disabled={deletingId === ingredient.id}
                    className="btn-danger px-3 py-2"
                    aria-label={`Xóa ${ingredient.name}`}
                  >
                    {deletingId === ingredient.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
