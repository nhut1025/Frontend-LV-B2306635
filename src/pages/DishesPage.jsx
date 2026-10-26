// src/pages/DishesPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ImagePlus, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { dishesApi } from '../api/dishes';
import { ingredientsApi } from '../api/ingredients';
import { categoriesApi } from '../api/categories';
import { getErrorMessage } from '../api/client';

const emptyForm = { name: '', description: '', price: '', category_id: '', image_urls: [], ingredient_ids: [] };

function formatPrice(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
}

export default function DishesPage() {
  const { categoryId } = useParams();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const canToggleAvailability = ['manager', 'phuc_vu', 'kitchen'].includes(user?.role);

  const [dishes, setDishes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [loadingDishId, setLoadingDishId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState('');

  const [ingredientSearch, setIngredientSearch] = useState('');
  const groupedDishes = useMemo(() => {
    const groups = categories.map((category) => ({
      id: String(category.id),
      name: category.name,
      dishes: dishes.filter((dish) => String(dish.category_id) === String(category.id)),
    }));
    const uncategorized = dishes.filter((dish) => !dish.category_id);
    if (uncategorized.length) groups.push({ id: 'uncategorized', name: 'Chưa phân loại', dishes: uncategorized });
    return groups;
  }, [categories, dishes]);
  const selectedGroup = categoryId === 'uncategorized'
    ? groupedDishes.find((group) => group.id === 'uncategorized')
    : groupedDishes.find((group) => group.id === String(categoryId));
  const visibleDishes = categoryId ? selectedGroup?.dishes || [] : dishes;

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const requests = [dishesApi.list(), categoriesApi.list()];
      if (isManager) requests.push(ingredientsApi.list());
      const [dishesRes, categoriesRes, ingredientsRes] = await Promise.all(requests);
      setDishes(dishesRes.data.dishes || []);
      setCategories(categoriesRes.data.categories || []);
      if (ingredientsRes) setIngredients(ingredientsRes.data.ingredients || []);
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
    setImageUrlDraft('');
    setForm({
      ...emptyForm,
      category_id: categories.some((category) => String(category.id) === String(categoryId))
        ? String(categoryId)
        : '',
    });
    setShowDishModal(true);
  }

  async function openEditModal(dish) {
    if (loadingDishId !== null) return;
    setLoadingDishId(dish.id);
    setError('');
    try {
      const response = await dishesApi.getById(dish.id);
      const fullDish = response.data?.dish;
      if (!fullDish) throw new Error('Không tải được thông tin món ăn.');

      setEditingDish(fullDish);
      setForm({
        name: fullDish.name,
        description: fullDish.description || '',
        price: formatPrice(fullDish.price),
        category_id: String(
          fullDish.category_id ||
          categories.find((category) => category.name === fullDish.category)?.id ||
          ''
        ),
        image_urls: fullDish.images?.length
          ? fullDish.images
          : (fullDish.image_url ? [fullDish.image_url] : []),
        ingredient_ids: (fullDish.ingredients || []).map((ingredient) => ingredient.id),
      });
      setImageUrlDraft('');
      setShowDishModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingDishId(null);
    }
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.image_urls.length + files.length > 10) {
      setError('Mỗi món chỉ được có tối đa 10 hình ảnh.');
      e.target.value = '';
      return;
    }
    const invalidFile = files.find((file) => !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024);
    if (invalidFile) {
      setError(!invalidFile.type.startsWith('image/')
        ? 'Vui lòng chọn file hình ảnh hợp lệ.'
        : `Ảnh "${invalidFile.name}" vượt quá giới hạn 20 MB.`);
      e.target.value = '';
      return;
    }

    setError('');
    setUploadingImage(true);
    try {
      for (const file of files) {
        const response = await dishesApi.uploadImage(file);
        setForm((current) => ({
          ...current,
          image_urls: current.image_urls.includes(response.data.image_url)
            ? current.image_urls
            : [...current.image_urls, response.data.image_url],
        }));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  function addImageUrl(event) {
    event.preventDefault();
    const url = imageUrlDraft.trim();
    if (!url) return;
    if (form.image_urls.length >= 10) {
      setError('Mỗi món chỉ được có tối đa 10 hình ảnh.');
      return;
    }
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported URL protocol');
    } catch {
      setError('URL hình ảnh không hợp lệ.');
      return;
    }
    setError('');
    setForm((current) => ({
      ...current,
      image_urls: current.image_urls.includes(url) ? current.image_urls : [...current.image_urls, url],
    }));
    setImageUrlDraft('');
  }

  function removeImage(url) {
    setForm((current) => ({ ...current, image_urls: current.image_urls.filter((image) => image !== url) }));
  }

  async function handleSaveDish(e) {
    e.preventDefault();
    if (uploadingImage) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        category_id: Number(form.category_id),
        image_url: form.image_urls[0] || '',
        price: Number(form.price.replace(/\D/g, '')),
      };
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

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {categoryId && !selectedGroup ? 'Danh mục không tồn tại' : selectedGroup?.name || 'Thực đơn'}
          </h1>
          <p className="text-sm text-slate-500">
            {categoryId ? `${visibleDishes.length} món trong danh mục` : `${dishes.length} món trong thực đơn`}
          </p>
        </div>
        {isManager && (
          <button onClick={openCreateModal} className="btn-primary">
            <Plus size={16} />
            Thêm món
          </button>
        )}
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      <nav aria-label="Danh mục món ăn" className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
        <Link
          to="/dishes"
          aria-current={!categoryId ? 'page' : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            !categoryId ? 'bg-basil-600 text-white' : 'bg-white text-slate-600 hover:bg-basil-50 hover:text-basil-700'
          }`}
        >
          Tất cả món <span className="ml-1 opacity-75">{dishes.length}</span>
        </Link>
        {groupedDishes.map((group) => {
          const active = String(categoryId) === group.id;
          return (
            <Link
              key={group.id}
              to={`/dishes/category/${group.id}`}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                active ? 'bg-basil-600 text-white' : 'bg-white text-slate-600 hover:bg-basil-50 hover:text-basil-700'
              }`}
            >
              {group.name} <span className="ml-1 opacity-75">{group.dishes.length}</span>
            </Link>
          );
        })}
      </nav>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : categoryId && !selectedGroup ? (
        <div className="card text-center text-sm text-slate-500">Danh mục này không tồn tại.</div>
      ) : visibleDishes.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          {categoryId ? 'Danh mục này chưa có món ăn nào.' : 'Chưa có món ăn nào.'}
          {isManager && categories.length === 0 && (
            <p className="mt-2">
              <Link to="/categories" className="font-medium text-basil-600 hover:text-basil-700">Tạo danh mục món ăn</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleDishes.map((dish) => (
                      <div key={dish.id} className="card flex flex-col gap-3">
                        {dish.image_url && (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="h-auto max-h-64 w-full rounded-xl bg-slate-50 object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-display text-base font-semibold text-ink">
                              <Link to={`/dishes/${dish.id}`} className="hover:text-basil-600">{dish.name}</Link>
                            </h3>
                          </div>
                          <p className="whitespace-nowrap font-mono text-sm font-semibold text-ink">
                            {Number(dish.price).toLocaleString('vi-VN')}đ
                          </p>
                        </div>

                        {dish.description && <p className="line-clamp-2 text-sm text-slate-500">{dish.description}</p>}

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
                                disabled={loadingDishId !== null}
                                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-basil-600"
                                aria-label="Sửa"
                              >
                                {loadingDishId === dish.id
                                  ? <Loader2 size={15} className="animate-spin" />
                                  : <Pencil size={15} />}
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
                  type="text"
                  inputMode="numeric"
                  required
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: formatPrice(e.target.value) }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="dish-category">Danh mục</label>
                <select
                  id="dish-category"
                  required
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="field-input"
                >
                  <option value="" disabled>Chọn danh mục</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                {categories.length === 0 && (
                  <p className="mt-1 text-xs text-clay-600">Chưa có danh mục. Hãy tạo danh mục trước khi thêm món.</p>
                )}
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
              <label className="field-label" htmlFor="dish-image-url">Ảnh minh họa (tối đa 10 ảnh)</label>
              <div className="flex gap-2">
                <input
                  id="dish-image-url"
                  type="url"
                  value={imageUrlDraft}
                  onChange={(event) => setImageUrlDraft(event.target.value)}
                  className="field-input flex-1"
                  placeholder="Thêm URL ảnh"
                />
                <button type="button" onClick={addImageUrl} disabled={!imageUrlDraft.trim() || form.image_urls.length >= 10} className="btn-secondary px-3">
                  <Plus size={16} /> URL
                </button>
              </div>
              <label className={`btn-secondary mt-2 w-full cursor-pointer ${uploadingImage || form.image_urls.length >= 10 ? 'pointer-events-none opacity-60' : ''}`}>
                {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {uploadingImage ? 'Đang tải ảnh...' : 'Chọn nhiều ảnh từ máy'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingImage || form.image_urls.length >= 10}
                  onChange={handleImageFileChange}
                  className="sr-only"
                />
              </label>
              <p className="mt-1 text-xs text-slate-500">Mỗi ảnh tối đa 20 MB. Ảnh đầu tiên được dùng làm ảnh đại diện.</p>
              {form.image_urls.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {form.image_urls.map((url, index) => (
                    <div key={url} className="relative">
                      <img
                        src={url}
                        alt={`${form.name || 'Món ăn'} — ảnh ${index + 1}`}
                        className="h-auto max-h-40 w-full rounded-xl bg-slate-50 object-contain"
                        onError={(event) => { event.currentTarget.style.opacity = '0.35'; }}
                      />
                      {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">Ảnh đại diện</span>}
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-clay-600 shadow hover:bg-white"
                        aria-label={`Xóa ảnh ${index + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Nguyên liệu</label>
              <p className="mb-2 text-xs text-slate-500">
                Quản lý danh sách tại <Link to="/ingredients" className="font-medium text-basil-600 hover:text-basil-700">trang nguyên liệu</Link>.
              </p>
              <input
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                placeholder="Tìm trong danh sách nguyên liệu"
                className="field-input mb-2"
              />
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {ingredients.filter((ing) => ing.name.toLocaleLowerCase().includes(ingredientSearch.trim().toLocaleLowerCase())).length === 0 && (
                  <p className="px-1 text-xs text-slate-400">
                    {ingredients.length === 0 ? 'Chưa có nguyên liệu nào.' : 'Không tìm thấy nguyên liệu.'}
                  </p>
                )}
                {ingredients
                  .filter((ing) => ing.name.toLocaleLowerCase().includes(ingredientSearch.trim().toLocaleLowerCase()))
                  .map((ing) => (
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
              <button type="button" onClick={() => setShowDishModal(false)} disabled={uploadingImage || saving} className="btn-secondary">
                Huỷ
              </button>
              <button type="submit" disabled={saving || uploadingImage || categories.length === 0} className="btn-primary">
                {saving ? 'Đang lưu...' : uploadingImage ? 'Đang tải ảnh...' : 'Lưu'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
