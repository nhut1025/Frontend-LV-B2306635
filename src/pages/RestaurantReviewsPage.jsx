import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MessageSquareQuote, Star } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { billsApi } from '../api/bills';
import { getErrorMessage } from '../api/client';

const RATING_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: '5', label: '5 sao' },
  { value: '4', label: '4 sao' },
  { value: '3', label: '3 sao' },
  { value: '2', label: '1–2 sao' },
];

const CATEGORY_LABELS = [
  { key: 'food_rating', label: 'Món ăn' },
  { key: 'service_rating', label: 'Phục vụ' },
  { key: 'ambience_rating', label: 'Không gian' },
];

function RatingStars({ value, size = 18 }) {
  const roundedRating = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${Number(value).toFixed(1)} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={size}
          fill={index < roundedRating ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function CategoryScore({ label, value, count }) {
  const score = Number(value) || 0;
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      {count > 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-basil-500"
            style={{ width: `${Math.min(100, Math.max(0, score * 20))}%` }}
          />
        </div>
      ) : (
        <span className="text-xs text-slate-400">Chưa có dữ liệu</span>
      )}
      <span className="text-right font-medium text-ink">{count > 0 ? score.toFixed(1) : '—'}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}

export default function RestaurantReviewsPage() {
  const [ratingFilter, setRatingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadReviews() {
      setLoading(true);
      setError('');
      try {
        const response = await billsApi.listRestaurantReviews({ rating: ratingFilter, page });
        if (active) setData(response.data);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadReviews();
    return () => { active = false; };
  }, [ratingFilter, page]);

  const summary = data?.summary;
  const totalPages = data?.total_pages || 0;

  return (
    <Layout>
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-basil-700">Trải nghiệm thực khách</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Đánh giá tổng quan nhà hàng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Đánh giá được gửi bởi khách hàng có bill đã thanh toán.
        </p>
      </header>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {summary && (
        <section className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.2fr)] md:p-6">
          <div className="flex flex-col items-center justify-center rounded-xl bg-basil-50 p-5 text-center">
            <p className="font-display text-4xl font-semibold text-ink">
              {summary.average_rating.toFixed(1)} <span className="text-xl text-slate-400">/ 5</span>
            </p>
            <RatingStars value={summary.average_rating} size={21} />
            <p className="mt-2 text-sm text-slate-600">
              {summary.review_count.toLocaleString('vi-VN')} đánh giá bill
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4 py-2">
            {CATEGORY_LABELS.map(({ key, label }) => (
              <CategoryScore
                key={key}
                label={label}
                value={summary[key]}
                count={summary[`${key}_count`]}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="review-list-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="review-list-heading" className="font-display text-lg font-semibold text-ink">
            Bình luận theo bill
          </h2>
          <div className="flex flex-wrap gap-2" aria-label="Lọc đánh giá theo số sao">
            {RATING_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={ratingFilter === filter.value}
                onClick={() => {
                  setPage(1);
                  setRatingFilter(filter.value);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  ratingFilter === filter.value
                    ? 'border-basil-600 bg-basil-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-basil-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        )}

        {!loading && !error && data?.reviews.length === 0 && (
          <div className="card py-10 text-center">
            <MessageSquareQuote className="mx-auto text-slate-300" size={30} />
            <p className="mt-3 text-sm text-slate-500">Chưa có đánh giá phù hợp với bộ lọc này.</p>
          </div>
        )}

        {!loading && !error && data?.reviews.length > 0 && (
          <>
            <div className="space-y-3">
              {data.reviews.map((review) => (
                <article key={review.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{review.reviewer_name || 'Khách hàng'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Bill đã thanh toán
                      </p>
                    </div>
                    <time className="text-xs text-slate-400" dateTime={review.paid_at || review.created_at}>
                      {formatDate(review.paid_at || review.created_at)}
                    </time>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <RatingStars value={review.rating} />
                    <span className="text-sm font-medium text-ink">{review.rating}/5</span>
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {CATEGORY_LABELS.map(({ key, label }) => (
                      <div key={key} className="flex gap-1">
                        <dt>{label}:</dt>
                        <dd className="font-medium text-slate-700">
                          {review[key] ? `${review[key]}/5` : 'Chưa có'}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.comment}</p>
                  {review.manager_reply && (
                    <div className="mt-4 rounded-xl border-l-4 border-basil-500 bg-basil-50 p-4">
                      <p className="text-sm font-semibold text-basil-800">
                        Phản hồi từ nhà hàng{review.manager_name ? ` · ${review.manager_name}` : ''}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.manager_reply}</p>
                      {review.replied_at && (
                        <time className="mt-2 block text-xs text-slate-500" dateTime={review.replied_at}>
                          {formatDate(review.replied_at)}
                        </time>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Phân trang đánh giá">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-600">Trang {page} / {totalPages}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                  aria-label="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </Layout>
  );
}
