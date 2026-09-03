// src/pages/DishesPage.jsx
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X as XIcon, Loader2, ImagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { dishesApi } from '../api/dishes';
import { ingredientsApi } from '../api/ingredients';
import { getErrorMessage } from '../api/client';

const emptyForm = { name: '', description: '', price: '', category: '', image_url: '', ingredient_ids: [] };

export default function DishesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const canToggleAvailability = ['manager', 'staff', 'kitchen'].includes(user?.role);

  const [dishes, setDishes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newIngredientName, setNewIngredientName] = useState('');

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const requests = [dishesApi.list()];
      if (isManager) requests.push(ingredientsApi.list());
      const [dishesRes, ingredientsRes] = await Promise.all(requests);
      setDishes(dishesRes.data.dishes);
      if (ingredientsRes) setIngredients(ingredientsRes.data.ingredients);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [isManager]);

  function openCreateModal() {
    setEditingDish(null);
    setForm(emptyForm);
    setShowDishModal(true);
  }

  function openEditModal(dish) {
    setEditingDish(dish);
    setForm({
      name: dish.name,
      description: dish.description || '',
      price: dish.price,
      category: dish.category || '',
      image_url: dish.image_url || '',
      ingredient_ids: (dish.ingredients || []).map((i) => i.id),
    });
    setShowDishModal(true);
  }

  function toggleIngredientInForm(id) {
    setForm((f) => ({
      ...f,
      ingredient_ids: f.ingredient_ids.includes(id)
        ? f.ingredient_ids.filter((x) => x !== id)
        : [...f.ingredient_ids, id],
    }));
  }

  async function handleImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn một file hình ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Hình ảnh không được lớn hơn 5 MB.');
      return;
    }

    setError('');
    setUploadingImage(true);
    try {
      const response = await dishesApi.uploadImage(file);
      setForm((current) => ({ ...current, image_url: response.data.image_url }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  async function handleSaveDish(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, price: Number(form.price) };
      if (editingDish) {
        await dishesApi.update(editingDish.id, payload);
      } else {
        await dishesApi.create(payload);
      }
      setShowDishModal(false);
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDish(dish) {
    if (!confirm(`Xoá món "${dish.name}"?`)) return;
    try {
      await dishesApi.remove(dish.id);
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleToggleAvailability(dish) {
    try {
      await dishesApi.toggleAvailability(dish.id, !dish.is_available);
      setDishes((prev) => prev.map((d) => (d.id === dish.id ? { ...d, is_available: !d.is_available } : d)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleAddIngredient(e) {
    e.preventDefault();
    if (!newIngredientName.trim()) return;
    try {
      await ingredientsApi.create(newIngredientName.trim());
      setNewIngredientName('');
      const res = await ingredientsApi.list();
      setIngredients(res.data.ingredients);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDeleteIngredient(id) {
    if (!confirm('Xoá nguyên liệu này? Các món đang gắn nguyên liệu này cũng sẽ mất liên kết.')) return;
    try {
      await ingredientsApi.remove(id);
      const res = await ingredientsApi.list();
      setIngredients(res.data.ingredients);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Món ăn</h1>
          <p className="text-sm text-slate-500">Quản lý thực đơn và nguyên liệu</p>
        </div>
        {isManager && (
          <button onClick={openCreateModal} className="btn-primary">
            <Plus size={16} />
            Thêm món
          </button>
        )}
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Danh sách món */}
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : dishes.length === 0 ? (
            <div className="card text-center text-sm text-slate-500">Chưa có món ăn nào.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {dishes.map((dish) => (
                <div key={dish.id} className="card flex flex-col gap-3">
                  {dish.image_url && (
                    <img
                      src={dish.image_url}
                      alt={dish.name}
                      className="h-40 w-full rounded-xl object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-semibold text-ink">
                        <Link to={`/dishes/${dish.id}`} className="hover:text-basil-600">{dish.name}</Link>
                      </h3>
                      {dish.category && (
                        <span className="mt-1 inline-block rounded-full bg-basil-50 px-2.5 py-0.5 text-xs font-medium text-basil-700">
                          {dish.category}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-sm font-semibold text-ink whitespace-nowrap">
                      {Number(dish.price).toLocaleString('vi-VN')}đ
                    </p>
                  </div>

                  {dish.description && <p className="text-sm text-slate-500 line-clamp-2">{dish.description}</p>}

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <Link to={`/dishes/${dish.id}`} className="text-xs font-semibold text-basil-600 hover:text-basil-700">
                      Xem chi tiết
                    </Link>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={dish.is_available}
                        disabled={!canToggleAvailability}
                        onChange={() => handleToggleAvailability(dish)}
                        className="h-4 w-4 rounded border-slate-300 text-basil-500 focus:ring-basil-500"
                      />
                      {dish.is_available ? 'Còn hàng' : 'Hết hàng'}
                    </label>

                    {isManager && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(dish)}
                          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-basil-600"
                          aria-label="Sửa"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteDish(dish)}
                          className="rounded-full p-1.5 text-slate-400 hover:bg-clay-50 hover:text-clay-500"
                          aria-label="Xoá"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nguyên liệu — chỉ manager quản lý */}
        {isManager && (
          <aside className="card h-fit">
            <h2 className="font-display text-base font-semibold text-ink">Nguyên liệu</h2>
            <form onSubmit={handleAddIngredient} className="mt-3 flex gap-2">
              <input
                value={newIngredientName}
                onChange={(e) => setNewIngredientName(e.target.value)}
                placeholder="Tên nguyên liệu"
                className="field-input flex-1"
              />
              <button type="submit" className="btn-secondary px-3">
                <Plus size={15} />
              </button>
            </form>
            <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-slate-50">
                  {ing.name}
                  <button
                    onClick={() => handleDeleteIngredient(ing.id)}
                    className="text-slate-300 hover:text-clay-500"
                    aria-label={`Xoá ${ing.name}`}
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {showDishModal && (
        <Modal title={editingDish ? 'Sửa món ăn' : 'Thêm món ăn'} onClose={() => setShowDishModal(false)}>
          <form onSubmit={handleSaveDish} className="space-y-4">
            <div>
              <label className="field-label">Tên món</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="field-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Giá (VNĐ)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Danh mục</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="field-input"
                  placeholder="Món chính..."
                />
              </div>
            </div>

            <div>
              <label className="field-label">Mô tả</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="field-input"
                rows={2}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="image_url">URL hình ảnh</label>
              <input
                id="image_url"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="field-input"
                placeholder="https://..."
              />
              <label className="btn-secondary mt-2 w-full cursor-pointer">
                <ImagePlus size={16} />
                {uploadingImage ? 'Đang tải ảnh...' : 'Chọn ảnh từ máy'}
                <input type="file" accept="image/*" onChange={handleImageFileChange} className="sr-only" />
              </label>
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="Xem trước món ăn"
                  className="mt-3 h-40 w-full rounded-xl object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>

            <div>
              <label className="field-label">Nguyên liệu</label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {ingredients.length === 0 && <p className="px-1 text-xs text-slate-400">Chưa có nguyên liệu nào.</p>}
                {ingredients.map((ing) => (
                  <label key={ing.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={form.ingredient_ids.includes(ing.id)}
                      onChange={() => toggleIngredientInForm(ing.id)}
                      className="h-4 w-4 rounded border-slate-300 text-basil-500 focus:ring-basil-500"
                    />
                    {ing.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowDishModal(false)} className="btn-secondary">
                Huỷ
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
