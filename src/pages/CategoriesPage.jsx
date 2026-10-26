import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { categoriesApi } from '../api/categories';
import { getErrorMessage } from '../api/client';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadCategories() {
    setLoading(true);
    setError('');
    try {
      const response = await categoriesApi.list();
      setCategories(response.data.categories || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function resetForm() {
    setName('');
    setEditingId(null);
  }

  function startEditing(category) {
    setEditingId(category.id);
    setName(category.name);
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
        await categoriesApi.create(trimmedName);
        setSuccess(`Đã thêm danh mục "${trimmedName}".`);
      } else {
        await categoriesApi.update(editingId, trimmedName);
        setSuccess(`Đã cập nhật danh mục "${trimmedName}".`);
      }
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    if (!window.confirm(`Xóa danh mục "${category.name}"? Danh mục đang được món ăn sử dụng sẽ không thể xóa.`)) return;
    setDeletingId(category.id);
    setError('');
    setSuccess('');
    try {
      await categoriesApi.remove(category.id);
      setSuccess(`Đã xóa danh mục "${category.name}".`);
      if (editingId === category.id) resetForm();
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Quản lý danh mục món ăn</h1>
        <p className="text-sm text-slate-500">Danh mục được lưu trong cơ sở dữ liệu và dùng khi tạo hoặc sửa món.</p>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

      <form onSubmit={handleSubmit} className="card mb-5">
        <label htmlFor="category-name" className="field-label">
          {editingId === null ? 'Tên danh mục mới' : 'Đổi tên danh mục'}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
            className="field-input flex-1"
            placeholder="Ví dụ: Món chính"
          />
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : editingId === null ? <Plus size={16} /> : <Check size={16} />}
            {editingId === null ? 'Thêm danh mục' : 'Lưu thay đổi'}
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
          <Tags size={18} /> Danh mục hiện có
        </h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
        ) : categories.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có danh mục nào. Hãy thêm danh mục để gán cho món ăn.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">{category.name}</p>
                  <p className="text-sm text-slate-500">{Number(category.dish_count || 0)} món</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEditing(category)} className="btn-secondary px-3 py-2" aria-label={`Sửa ${category.name}`}>
                    <Pencil size={15} /> Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(category)}
                    disabled={deletingId === category.id}
                    className="btn-danger px-3 py-2"
                    aria-label={`Xóa ${category.name}`}
                  >
                    {deletingId === category.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
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
