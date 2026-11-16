// src/pages/DishesPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ImagePlus, X, Search, CalendarDays, Clock3, MapPin, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { dishesApi } from '../api/dishes';
import { ingredientsApi } from '../api/ingredients';
import { categoriesApi } from '../api/categories';
import { reservationsApi } from '../api/reservations';
import { settingsApi } from '../api/settings';
import { getErrorMessage } from '../api/client';
import DishRecommendations from '../components/DishRecommendations';

const emptyForm = { name: '', description: '', price: '', category_id: '', image_urls: [], ingredients: [], tags: [] };

function formatPrice(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('vi')
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function hasVietnameseDiacritics(value) {
  return value.includes('đ') || /\p{M}/u.test(value.normalize('NFD'));
}

function isAvailable(dish) {
  return dish.is_available === true || Number(dish.is_available) === 1;
}

function reservationDateTime(reservation) {
  const date = String(reservation.reservation_date || '').slice(0, 10);
  const time = String(reservation.reservation_time || '').slice(0, 8);
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export default function DishesPage() {
  const { categoryId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const isManager = user?.role === 'manager';
  const canToggleAvailability = ['manager', 'phuc_vu', 'kitchen'].includes(user?.role);
  const isCustomerFacing = !user || user.role === 'customer';

  const [dishes, setDishes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dishTags, setDishTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('name');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [upcomingReservation, setUpcomingReservation] = useState(null);
  const [upcomingReservationError, setUpcomingReservationError] = useState('');
  const [reservationRules, setReservationRules] = useState({
    reservation_open_time: '07:00',
    reservation_close_time: '21:00',
    reservation_hold_minutes: 15,
  });

  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [loadingDishId, setLoadingDishId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [dishFormError, setDishFormError] = useState('');

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
  const filteredDishes = useMemo(() => {
    const queryTerms = tokenizeSearchText(searchTerm);
    return visibleDishes
      .filter((dish) => {
        if (queryTerms.length === 0) return true;
        const nameTerms = tokenizeSearchText(dish.name);
        return queryTerms.every((term) => nameTerms.some((nameTerm) => (
          hasVietnameseDiacritics(term)
            ? term === nameTerm
            : normalizeSearchText(term) === normalizeSearchText(nameTerm)
        )));
      })
      .filter((dish) => !availableOnly || isAvailable(dish))
      .slice()
      .sort((first, second) => {
        if (sortOrder === 'price-asc') return Number(first.price) - Number(second.price);
        if (sortOrder === 'price-desc') return Number(second.price) - Number(first.price);
        return first.name.localeCompare(second.name, 'vi');
      });
  }, [availableOnly, searchTerm, sortOrder, visibleDishes]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const requests = [dishesApi.list(), categoriesApi.list(), dishesApi.listTags()];
      if (isManager) requests.push(ingredientsApi.list());
      const [dishesRes, categoriesRes, tagsRes, ingredientsRes] = await Promise.all(requests);
      setDishes(dishesRes.data.dishes || []);
      setCategories(categoriesRes.data.categories || []);
      setDishTags(tagsRes.data.tags || []);
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

  useEffect(() => {
    settingsApi.getReservationRules()
      .then((response) => setReservationRules(response.data))
      .catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  useEffect(() => {
    if (user?.role !== 'customer') {
      setUpcomingReservation(null);
      setUpcomingReservationError('');
      return undefined;
    }

    let active = true;
    reservationsApi.listMine()
      .then((response) => {
        if (!active) return;
        const now = Date.now();
        const nextReservation = (response.data.reservations || [])
          .filter((reservation) => ['giu_tam', 'da_dat'].includes(reservation.status))
          .map((reservation) => ({ ...reservation, startsAt: reservationDateTime(reservation) }))
          .filter((reservation) => reservation.startsAt && reservation.startsAt.getTime() >= now)
          .sort((first, second) => first.startsAt - second.startsAt)[0] || null;
        setUpcomingReservation(nextReservation);
      })
      .catch((err) => {
        if (active) setUpcomingReservationError(getErrorMessage(err));
      });

    return () => { active = false; };
  }, [user?.id, user?.role]);

  function openCreateModal() {
    setEditingDish(null);
    setImageUrlDraft('');
    setDishFormError('');
    setForm({
      ...emptyForm,
      category_id: categories.some((category) => String(category.id) === String(categoryId))
        ? String(categoryId)
        : '',
      tags: [],
    });
    setShowDishModal(true);
  }

  async function openEditModal(dish) {
    if (loadingDishId !== null) return;
    setLoadingDishId(dish.id);
    setError('');
    setDishFormError('');
    try {
      const response = await dishesApi.getById(dish.id);
      const fullDish = response.data?.dish;
      if (!fullDish) throw new Error('Không tải được thông tin món ăn.');

      setEditingDish(fullDish);
      setForm({
        name: fullDish.name,
        description: fullDish.description || '',
        price: formatPrice(Math.trunc(Number(fullDish.price))),
        category_id: String(
          fullDish.category_id ||
          categories.find((category) => category.name === fullDish.category)?.id ||
          ''
        ),
        image_urls: fullDish.images?.length
          ? fullDish.images
          : (fullDish.image_url ? [fullDish.image_url] : []),
        ingredients: (fullDish.ingredients || []).map((ingredient) => ({
          ingredient_id: Number(ingredient.id),
          quantity_g: ingredient.quantity_g == null ? '' : String(ingredient.quantity_g),
        })),
        tags: (fullDish.tags || []).map((tag) => Number(tag.id)),
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
      ingredients: f.ingredients.some((item) => item.ingredient_id === Number(id))
        ? f.ingredients.filter((item) => item.ingredient_id !== Number(id))
        : [...f.ingredients, { ingredient_id: Number(id), quantity_g: '' }],
    }));
  }

  function toggleTagInForm(tagId) {
    const numericTagId = Number(tagId);
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(numericTagId)
        ? f.tags.filter((value) => value !== numericTagId)
        : [...f.tags, numericTagId],
    }));
  }

  function updateIngredientQuantity(id, quantity) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((item) => (
        item.ingredient_id === Number(id) ? { ...item, quantity_g: quantity } : item
      )),
    }));
  }

  async function handleImageFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.image_urls.length + files.length > 10) {
      setDishFormError('Mỗi món chỉ được có tối đa 10 hình ảnh.');
      e.target.value = '';
      return;
    }
    const invalidFile = files.find((file) => !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024);
    if (invalidFile) {
      setDishFormError(!invalidFile.type.startsWith('image/')
        ? 'Vui lòng chọn file hình ảnh hợp lệ.'
        : `Ảnh "${invalidFile.name}" vượt quá giới hạn 20 MB.`);
      e.target.value = '';
      return;
    }

    setDishFormError('');
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
      setDishFormError(getErrorMessage(err));
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
      setDishFormError('Mỗi món chỉ được có tối đa 10 hình ảnh.');
      return;
    }
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported URL protocol');
    } catch {
      setDishFormError('URL hình ảnh không hợp lệ.');
      return;
    }
    setDishFormError('');
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
    setDishFormError('');
    try {
    const { tags, ...dishForm } = form;
      const payload = {
      ...dishForm,
        category_id: Number(form.category_id),
        image_url: form.image_urls[0] || '',
        price: Number(form.price.replace(/\D/g, '')),
        ingredients: form.ingredients.map((ingredient) => ({
          ingredient_id: ingredient.ingredient_id,
          quantity_g: String(ingredient.quantity_g ?? '').trim() === ''
            ? null
            : Number(ingredient.quantity_g),
        })),
        tag_ids: tags,
      };
      if (editingDish) {
        await dishesApi.update(editingDish.id, payload);
      } else {
        await dishesApi.create(payload);
      }
      setShowDishModal(false);
      await loadAll();
    } catch (err) {
      setDishFormError(getErrorMessage(err));
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
      const nextAvailability = !isAvailable(dish);
      await dishesApi.toggleAvailability(dish.id, nextAvailability);
      setDishes((prev) => prev.map((d) => (d.id === dish.id ? { ...d, is_available: nextAvailability } : d)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Layout flushTop>
      <div className="mx-auto max-w-6xl space-y-7 pb-8">
      <div className="sticky top-0 z-30 -mx-3 space-y-3 border-b border-slate-300 bg-slate-100 px-3 py-3 shadow-sm md:-mx-8 md:px-8">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_190px_auto] sm:items-center">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm món không dấu theo tên, danh mục..."
              aria-label="Tìm món theo tên, danh mục hoặc mô tả"
              className="field-input pl-10"
            />
          </label>
          <label>
            <span className="sr-only">Sắp xếp món ăn</span>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="field-input">
              <option value="name">Sắp xếp: Tên món</option>
              <option value="price-asc">Giá: Thấp đến cao</option>
              <option value="price-desc">Giá: Cao đến thấp</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => setAvailableOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-basil-600 focus:ring-basil-500"
            />
            Chỉ món còn hàng
          </label>
        </div>

        <nav aria-label="Danh mục món ăn" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
          <Link
            to="/dishes"
            aria-current={!categoryId ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              !categoryId ? 'bg-basil-600 text-white' : 'bg-white text-slate-600 hover:bg-basil-50 hover:text-basil-700'
            }`}
          >
            Tất cả món <span className="ml-1 opacity-75">{dishes.length}</span>
          </Link>
          {groupedDishes.filter((group) => group.dishes.length > 0).map((group) => {
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
      </div>

      {isCustomerFacing && (
        <section className="flex flex-col justify-between gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-basil-700 via-basil-600 to-emerald-800 px-6 py-8 text-white shadow-sm sm:flex-row sm:items-center sm:px-9 sm:py-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-basil-100">Quán Ăn Minh Nhựt</p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Món ngon, sẵn sàng chờ bạn</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-basil-50">
              Khám phá thực đơn nhà làm trong không gian ấm cúng. Mở cửa hằng ngày từ {reservationRules.reservation_open_time} đến {reservationRules.reservation_close_time}.
            </p>
          </div>
          <Link to="/tables" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-basil-700 transition hover:bg-basil-50">
            <CalendarDays size={17} /> Đặt bàn ngay
          </Link>
        </section>
      )}

      {user?.role === 'customer' && upcomingReservationError && (
        <Alert type="error">Không tải được lịch đặt bàn sắp tới: {upcomingReservationError}</Alert>
      )}
      {user?.role === 'customer' && upcomingReservation && (
        <section className="rounded-2xl border border-basil-100 bg-basil-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-basil-700">Lịch đặt bàn sắp tới</p>
            <p className="mt-1 font-semibold text-ink">
              {upcomingReservation.startsAt.toLocaleDateString('vi-VN')} lúc {upcomingReservation.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              <span className="mx-2 text-slate-400">·</span>
              {upcomingReservation.party_size} khách
              {upcomingReservation.table_ids && <span className="ml-2">· Bàn {upcomingReservation.table_ids}</span>}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {upcomingReservation.status === 'da_dat' ? 'Đã đặt, đã xác nhận cọc' : 'Đang giữ bàn, vui lòng hoàn tất cọc đúng hạn'}
            </p>
          </div>
          <Link to="/my-reservations" className="mt-3 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-basil-700 hover:text-basil-800 sm:mt-0">
            Xem lịch sử đặt bàn
          </Link>
        </section>
      )}

      {isCustomerFacing && !authLoading && !categoryId && !searchTerm.trim() && (
        <DishRecommendations isCustomer={user?.role === 'customer'} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            {categoryId && !selectedGroup ? 'Danh mục không tồn tại' : selectedGroup?.name || 'Thực đơn'}
          </h2>
          <p className="text-sm text-slate-500">
            {categoryId ? `${filteredDishes.length} món trong danh mục` : `${filteredDishes.length} món trong thực đơn`}
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : categoryId && !selectedGroup ? (
        <div className="card text-center text-sm text-slate-500">Danh mục này không tồn tại.</div>
      ) : filteredDishes.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          {searchTerm || availableOnly
            ? 'Không tìm thấy món phù hợp với bộ lọc hiện tại.'
            : categoryId ? 'Danh mục này chưa có món ăn nào.' : 'Chưa có món ăn nào.'}
          {isManager && categories.length === 0 && (
            <p className="mt-2">
              <Link to="/categories" className="font-medium text-basil-600 hover:text-basil-700">Tạo danh mục món ăn</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDishes.map((dish) => {
            const available = isAvailable(dish);
            return (
              <article key={dish.id} className="card flex flex-col gap-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-50">
                  {dish.image_url ? (
                    <img
                      src={dish.image_url}
                      alt={dish.name}
                      className={`h-full w-full object-cover transition ${available ? '' : 'opacity-45 grayscale'}`}
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có hình ảnh</div>
                  )}
                  {!available && (
                    <span className="absolute left-0 top-4 -translate-x-1 rotate-[-35deg] bg-clay-600 px-8 py-1 text-xs font-bold uppercase tracking-wider text-white shadow">
                      Hết hàng
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-basil-700">
                      {dish.category || 'Khác'}
                    </p>
                    <h3 className="font-display text-base font-semibold text-ink">
                      <Link to={`/dishes/${dish.id}`} className="hover:text-basil-600">{dish.name}</Link>
                    </h3>
                  </div>
                  <p className="whitespace-nowrap font-mono text-sm font-semibold text-ink">
                    {Number(dish.price).toLocaleString('vi-VN')}đ
                  </p>
                </div>
                {dish.description && <p className="line-clamp-2 text-sm text-slate-500">{dish.description}</p>}
                {dish.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {dish.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <Link to={`/dishes/${dish.id}`} className="inline-flex items-center rounded-full bg-basil-50 px-3.5 py-2 text-xs font-semibold text-basil-700 transition hover:bg-basil-100">
                    Xem chi tiết
                  </Link>
                  {canToggleAvailability ? (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={available}
                        onChange={() => handleToggleAvailability(dish)}
                        className="h-4 w-4 rounded border-slate-300 text-basil-500 focus:ring-basil-500"
                      />
                      {available ? 'Còn hàng' : 'Hết hàng'}
                    </label>
                  ) : (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-basil-50 text-basil-700' : 'bg-clay-50 text-clay-600'}`}>
                      {available ? 'Còn hàng' : 'Hết hàng'}
                    </span>
                  )}

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
              </article>
            );
          })}
        </div>
      )}

      {isCustomerFacing && !authLoading && (categoryId || searchTerm.trim()) && (
        <DishRecommendations isCustomer={user?.role === 'customer'} />
      )}

      {isCustomerFacing && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="font-display text-xl font-semibold text-ink">Thông tin quán</h2>
          <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <p className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-basil-600" /><span>Địa chỉ: Cần Thơ</span></p>
            <p className="flex items-start gap-2"><Phone size={17} className="mt-0.5 shrink-0 text-basil-600" /><span>Điện thoại: <a href="tel:0942726775" className="font-medium text-basil-700 hover:underline">0942726775</a></span></p>
            <p className="flex items-start gap-2"><Clock3 size={17} className="mt-0.5 shrink-0 text-basil-600" /><span>Giờ mở cửa: Hằng ngày, {reservationRules.reservation_open_time}–{reservationRules.reservation_close_time}</span></p>
            <p className="flex items-start gap-2"><CalendarDays size={17} className="mt-0.5 shrink-0 text-basil-600" /><span>Đặt bàn cần cọc 50.000đ; hoặc 50% bill nếu đặt món trước. Bàn được giữ trong {reservationRules.reservation_hold_minutes} phút để hoàn tất thanh toán.</span></p>
          </div>
          <Link to="/tables" className="mt-5 inline-flex items-center rounded-full bg-basil-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-basil-700">
            Xem sơ đồ và đặt bàn
          </Link>
        </section>
      )}

      {showDishModal && (
        <Modal title={editingDish ? 'Sửa món ăn' : 'Thêm món ăn'} onClose={() => setShowDishModal(false)}>
          <form onSubmit={handleSaveDish} className="space-y-4">
            {dishFormError && <Alert type="error">{dishFormError}</Alert>}
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
              <label className="field-label">Thẻ món ăn</label>
              <div className="flex flex-wrap gap-2">
                {dishTags.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có thẻ món ăn nào.</p>
                ) : dishTags.map((tag) => {
                  const checked = form.tags.includes(Number(tag.id));
                  return (
                    <label
                      key={tag.id}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        checked ? 'border-basil-500 bg-basil-50 text-basil-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleTagInForm(tag.id)}
                      />
                      {tag.name}
                    </label>
                  );
                })}
              </div>
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
              <p className="mb-2 text-xs text-slate-500">
                Định lượng cho 1 món, tính bằng gam. Nhập cho nguyên liệu chính; để trống nếu là gia vị.
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
                  .map((ing) => {
                    const selectedIngredient = form.ingredients.find(
                      (item) => item.ingredient_id === Number(ing.id)
                    );
                    return (
                      <div key={ing.id} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                        <label htmlFor={`dish-ingredient-${ing.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                          <input
                            id={`dish-ingredient-${ing.id}`}
                            type="checkbox"
                            checked={Boolean(selectedIngredient)}
                            onChange={() => toggleIngredientInForm(ing.id)}
                            className="h-4 w-4 rounded border-slate-300 text-basil-500 focus:ring-basil-500"
                          />
                          <span>{ing.name}</span>
                        </label>
                        {selectedIngredient && (
                          <div className="flex shrink-0 items-center gap-1">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={selectedIngredient.quantity_g}
                              onChange={(event) => updateIngredientQuantity(ing.id, event.target.value)}
                              placeholder="Gia vị"
                              aria-label={`Định lượng ${ing.name} cho một món, tính bằng gam`}
                              className="field-input w-24 py-1 text-right"
                            />
                            <span className="text-xs text-slate-500">g</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
      </div>
    </Layout>
  );
}
