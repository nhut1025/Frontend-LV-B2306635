import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Loader2, MessageSquareQuote, Star, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { billsApi } from '../api/bills';
import { dishesApi } from '../api/dishes';
import { tablesApi } from '../api/tables';
import { getErrorMessage } from '../api/client';
import { RestaurantFloor } from './ReservationPage';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
}

function RatingStars({ value }) {
  const rating = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${Number(value).toFixed(1)} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={16} fill={index < rating ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function PublicHomePage() {
  const [dishes, setDishes] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadPublicContent() {
      setLoading(true);
      const results = await Promise.allSettled([
        dishesApi.list({ available_only: true }),
        billsApi.listRestaurantReviews({ page: 1 }),
        tablesApi.list(),
      ]);
      if (!active) return;

      const nextErrors = [];
      if (results[0].status === 'fulfilled') {
        setDishes(results[0].value.data.dishes || []);
      } else {
        nextErrors.push(`Không tải được thực đơn: ${getErrorMessage(results[0].reason)}`);
      }
      if (results[1].status === 'fulfilled') {
        setReviews(results[1].value.data);
      } else {
        nextErrors.push(`Không tải được đánh giá: ${getErrorMessage(results[1].reason)}`);
      }
      if (results[2].status === 'fulfilled') {
        setTables((results[2].value.data.tables || []).map((table) => ({ ...table, status: 'trong' })));
      } else {
        nextErrors.push(`Không tải được sơ đồ không gian: ${getErrorMessage(results[2].reason)}`);
      }
      setErrors(nextErrors);
      setLoading(false);
    }

    loadPublicContent();
    return () => { active = false; };
  }, []);

  const featuredDishes = dishes.slice(0, 6);
  const recentReviews = reviews?.reviews?.slice(0, 3) || [];
  const dishesFailed = errors.some((error) => error.startsWith('Không tải được thực đơn'));
  const reviewsFailed = errors.some((error) => error.startsWith('Không tải được đánh giá'));

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-12 pb-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-basil-700 via-basil-600 to-emerald-800 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-basil-100">Chào mừng bạn</p>
          <div className="mt-4 grid items-center gap-8 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-5xl">
                Một không gian ấm cúng, dành cho những cuộc gặp gỡ đáng nhớ
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-basil-50 sm:text-base">
                Khám phá cách bố trí nhà hàng, xem thực đơn và đọc chia sẻ từ những thực khách đã ghé thăm.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/dishes" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-basil-700 hover:bg-basil-50">
                  <UtensilsCrossed size={17} /> Khám phá thực đơn
                </Link>
                <Link to="/tables" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  <CalendarDays size={17} /> Đặt bàn
                </Link>
              </div>
              <p className="mt-3 text-xs text-basil-100">Đặt bàn cần đăng nhập; bạn có thể xem nội dung quán mà không cần tài khoản.</p>
            </div>
            <div className="hidden justify-center md:flex" aria-hidden="true">
              <div className="flex h-48 w-48 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/30 bg-white/10">
                  <UtensilsCrossed size={64} strokeWidth={1.2} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {errors.length > 0 && (
          <div className="space-y-2">
            {errors.map((error) => <Alert key={error} type="error">{error}</Alert>)}
          </div>
        )}

        <section aria-labelledby="public-space-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">Không gian quán</p>
            <h2 id="public-space-heading" className="mt-1 font-display text-2xl font-semibold text-ink">
              Khám phá sơ đồ nhà hàng
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Xem cách sắp xếp các vị trí bàn trước khi ghé thăm. Sơ đồ không hiển thị bàn nào đang được đặt.
            </p>
          </div>
          <div className="reservation-page">
            <RestaurantFloor
              tables={tables}
              matches={[]}
              selectedTables={[]}
              searched={false}
              loading={loading}
              error={errors.some((error) => error.startsWith('Không tải được sơ đồ')) ? 'Chưa thể tải sơ đồ không gian.' : ''}
              panelVisible={false}
              onTogglePanel={() => {}}
              onSelect={() => {}}
              showPanelToggle={false}
              preview
            />
          </div>
        </section>

        <section aria-labelledby="public-dishes-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">Từ căn bếp</p>
              <h2 id="public-dishes-heading" className="mt-1 font-display text-2xl font-semibold text-ink">Món ăn nổi bật</h2>
            </div>
            <Link to="/dishes" className="inline-flex items-center gap-1 text-sm font-semibold text-basil-700 hover:text-basil-800">
              Xem toàn bộ thực đơn <ArrowRight size={16} />
            </Link>
          </div>
          {loading && dishes.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : dishesFailed ? (
            <div className="card text-sm text-slate-500">Chưa thể tải thực đơn. Vui lòng thử lại sau.</div>
          ) : featuredDishes.length === 0 ? (
            <div className="card text-sm text-slate-500">Hiện chưa có món ăn để giới thiệu.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredDishes.map((dish) => (
                <article key={dish.id} className="card flex flex-col gap-3">
                  {dish.image_url ? (
                    <img
                      src={dish.image_url}
                      alt={dish.name}
                      className="h-48 w-full rounded-xl bg-slate-50 object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-xl bg-basil-50 text-basil-600">
                      <UtensilsCrossed size={32} strokeWidth={1.4} />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-base font-semibold text-ink">{dish.name}</h3>
                    <span className="shrink-0 font-mono text-sm font-semibold text-ink">
                      {Number(dish.price).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  {dish.description && <p className="line-clamp-2 text-sm text-slate-500">{dish.description}</p>}
                  <Link to={`/dishes/${dish.id}`} className="mt-auto text-sm font-semibold text-basil-700 hover:text-basil-800">
                    Xem món <ArrowRight size={14} className="ml-1 inline" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="public-reviews-heading" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">Thực khách chia sẻ</p>
              <h2 id="public-reviews-heading" className="mt-1 font-display text-2xl font-semibold text-ink">Đánh giá nhà hàng</h2>
            </div>
            <Link to="/restaurant-reviews" className="inline-flex items-center gap-1 text-sm font-semibold text-basil-700 hover:text-basil-800">
              Xem tất cả đánh giá <ArrowRight size={16} />
            </Link>
          </div>

          {reviews?.summary && (
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-basil-50 p-4">
              <span className="font-display text-3xl font-semibold text-ink">{reviews.summary.average_rating.toFixed(1)}</span>
              <RatingStars value={reviews.summary.average_rating} />
              <span className="text-sm text-slate-600">{reviews.summary.review_count.toLocaleString('vi-VN')} đánh giá</span>
            </div>
          )}

          {loading && !reviews ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : reviewsFailed ? (
            <div className="py-6 text-center text-sm text-slate-500">Chưa thể tải đánh giá. Vui lòng thử lại sau.</div>
          ) : recentReviews.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {recentReviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <RatingStars value={review.rating} />
                    <time className="text-xs text-slate-400">{formatDate(review.paid_at || review.created_at)}</time>
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.comment}</p>
                  {review.manager_reply && (
                    <p className="mt-3 line-clamp-3 rounded-lg bg-basil-50 p-3 text-xs leading-5 text-basil-900">
                      <span className="font-semibold">Nhà hàng phản hồi: </span>{review.manager_reply}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">
              <MessageSquareQuote className="mx-auto mb-2 text-slate-300" size={26} />
              Chưa có đánh giá để hiển thị.
            </div>
          )}
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-basil-100 bg-basil-50 p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Bạn đã sẵn sàng ghé thăm?</h2>
            <p className="mt-1 text-sm text-slate-600">Đăng nhập để chọn thời gian và đặt bàn phù hợp.</p>
          </div>
          <Link to="/tables" className="btn-primary shrink-0">
            <CalendarDays size={16} /> Đặt bàn ngay
          </Link>
        </section>
      </div>
    </Layout>
  );
}
