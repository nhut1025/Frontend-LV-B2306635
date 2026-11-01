import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MessageSquareText, Star } from 'lucide-react';
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

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function RatingStars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${rating} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={17} fill={index < rating ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function ManagerReviewsPage() {
  const [ratingFilter, setRatingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function loadReviews() {
      setLoading(true);
      setError('');
      try {
        const response = await billsApi.listRestaurantReviews({ rating: ratingFilter, page });
        if (active) {
          setData(response.data);
          setDrafts((current) => {
            const next = { ...current };
            response.data.reviews.forEach((review) => {
              if (!(review.id in next)) next[review.id] = review.manager_reply || '';
            });
            return next;
          });
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadReviews();
    return () => { active = false; };
  }, [ratingFilter, page]);

  async function saveReply(reviewId) {
    setSavingId(reviewId);
    setSaveError('');
    setSavedMessage('');
    try {
      const response = await billsApi.replyToReview(reviewId, drafts[reviewId] || '');
      setData((current) => current && ({
        ...current,
        reviews: current.reviews.map((review) => (
          review.id === reviewId ? { ...review, ...response.data.reply } : review
        )),
      }));
      setDrafts((current) => ({ ...current, [reviewId]: response.data.reply.manager_reply }));
      setSavedMessage(`Đã lưu phản hồi cho đánh giá #${reviewId}.`);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  const totalPages = data?.total_pages || 0;

  return (
    <Layout>
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-basil-700">Khu vực quản lý</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Quản lý đánh giá</h1>
        <p className="mt-1 text-sm text-slate-500">
          Xem đánh giá của khách hàng và gửi hoặc chỉnh sửa phản hồi của nhà hàng.
        </p>
      </header>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {saveError && <div className="mb-4"><Alert type="error">{saveError}</Alert></div>}
      {savedMessage && <div className="mb-4"><Alert type="success">{savedMessage}</Alert></div>}

      <section aria-labelledby="manager-review-list-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="manager-review-list-heading" className="font-display text-lg font-semibold text-ink">
            Đánh giá của khách
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
            <MessageSquareText className="mx-auto text-slate-300" size={30} />
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
                        Bill thanh toán lúc {formatDate(review.paid_at || review.created_at)}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">Đánh giá #{review.id}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <RatingStars rating={review.rating} />
                    <span className="text-sm font-medium text-ink">{review.rating}/5</span>
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {CATEGORY_LABELS.map(({ key, label }) => (
                      <div key={key} className="flex gap-1">
                        <dt>{label}:</dt>
                        <dd className="font-medium text-slate-700">{review[key] ? `${review[key]}/5` : 'Chưa có'}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.comment}</p>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <label htmlFor={`reply-${review.id}`} className="text-sm font-semibold text-ink">
                      Phản hồi của nhà hàng
                    </label>
                    <textarea
                      id={`reply-${review.id}`}
                      rows={3}
                      maxLength={2000}
                      value={drafts[review.id] ?? ''}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [review.id]: event.target.value,
                      }))}
                      placeholder="Nhập phản hồi (tối đa 2000 ký tự)"
                      className="input mt-2 w-full resize-y"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">
                        {review.replied_at ? `Đã phản hồi ${formatDate(review.replied_at)}` : 'Chưa có phản hồi'}
                        {' · '}{(drafts[review.id] || '').length}/2000
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={savingId === review.id || !(drafts[review.id] || '').trim()}
                        onClick={() => saveReply(review.id)}
                      >
                        {savingId === review.id && <Loader2 size={15} className="animate-spin" />}
                        {review.manager_reply ? 'Cập nhật phản hồi' : 'Gửi phản hồi'}
                      </button>
                    </div>
                  </div>
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
