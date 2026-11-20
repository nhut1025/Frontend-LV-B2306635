import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { dishesApi } from '../api/dishes';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import DishRecommendations from '../components/DishRecommendations';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import { formatCurrency, formatDate } from '../i18n/formatters';

export default function DishDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useCustomerTranslation();
  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState({ summary: null, reviews: [] });
  const [reviewsError, setReviewsError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const images = useMemo(() => {
    if (dish?.images?.length) return dish.images;
    return dish?.image_url ? [dish.image_url] : [];
  }, [dish]);

  useEffect(() => {
    let active = true;
    setReviews({ summary: null, reviews: [] });
    setReviewsError('');
    async function loadDish() {
      setLoading(true);
      setError('');
      try {
        const response = await dishesApi.getById(id);
        if (active) {
          setDish(response.data.dish);
          setActiveImageIndex(0);
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
      try {
        const response = await dishesApi.getReviews(id);
        if (active) setReviews(response.data);
      } catch (err) {
        if (active) setReviewsError(getErrorMessage(err));
      }
    }
    loadDish();
    return () => { active = false; };
  }, [id]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <Link to="/dishes" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-basil-600">
          <ArrowLeft size={16} />
          {t('dishDetail.backToMenu')}
        </Link>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        )}

        {!loading && error && <Alert type="error">{error}</Alert>}

        {!loading && !error && dish && (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <article className="min-w-0">
          {images.length > 0 && (
            <section aria-label={t('dishDetail.imagesLabel', { name: dish.name })}>
              <img
                src={images[activeImageIndex] || images[0]}
                alt={t('dishDetail.imageOfDish', { count: activeImageIndex + 1, name: dish.name })}
                className="h-auto max-h-[70vh] w-full rounded-2xl bg-slate-100 object-contain"
              />
              {images.length > 1 && (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={t('dishDetail.imageOfDish', { count: index + 1, name: dish.name })}
                      aria-pressed={activeImageIndex === index}
                      className={`shrink-0 overflow-hidden rounded-xl border-2 ${
                        activeImageIndex === index ? 'border-basil-500' : 'border-transparent'
                      }`}
                    >
                      <img src={image} alt="" className="h-16 w-20 object-cover sm:h-20 sm:w-24" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <div className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">{dish.name}</h1>
                {dish.category && (
                  <span className="mt-2 inline-block rounded-full bg-basil-50 px-2.5 py-0.5 text-xs font-medium text-basil-700">
                    {dish.category}
                  </span>
                )}
                {dish.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dish.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="font-mono text-lg font-semibold text-ink">
                {formatCurrency(dish.price, locale)}
              </p>
            </div>

            {dish.contains_excluded_ingredient && (
              <p className="mt-4 text-amber-600">
                {t('dishDetail.ingredientWarning')}
              </p>
            )}

            {dish.description && <p className="mt-5 text-slate-600">{dish.description}</p>}

            {dish.ingredients?.length > 0 && (
              <section className="mt-6">
                <h2 className="font-display text-base font-semibold text-ink">{t('dishDetail.ingredients')}</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {dish.ingredients.map((ingredient) => (
                    <li key={ingredient.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                      {ingredient.name}
                      {ingredient.quantity_g != null && (
                        <> · {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(ingredient.quantity_g))} g</>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="dish-reviews-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="dish-reviews-heading" className="font-display text-xl font-semibold text-ink">
                  {t('dishDetail.reviews')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('dishDetail.reviewDescription')}
                </p>
              </div>
              {reviews.summary && reviews.summary.review_count > 0 && (
                <div className="text-right text-sm text-slate-600">
                  <p>{t('dishDetail.reviewCount', { count: reviews.summary.review_count })}</p>
                  <p className="text-xs text-slate-500">
                    {t('dishDetail.likeDislikeCount', {
                      likes: reviews.summary.like_count,
                      dislikes: reviews.summary.dislike_count,
                    })}
                  </p>
                </div>
              )}
            </div>

            {reviewsError && <div className="mt-4"><Alert type="error">{reviewsError}</Alert></div>}
            {!reviewsError && reviews.summary?.review_count === 0 && (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                {t('dishDetail.noReviews')}
              </p>
            )}
            {reviews.reviews.length > 0 && (
              <div className="mt-4 space-y-3">
                {reviews.reviews.map((review) => (
                  <article key={review.feedback_id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <time className="text-xs text-slate-400" dateTime={review.created_at}>
                        {formatDate(review.created_at, locale)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{review.comment}</p>
                    <p className={`mt-3 flex items-center gap-1 text-sm font-medium ${
                      review.sentiment === 'like' ? 'text-basil-700' : 'text-clay-600'
                    }`}>
                      {review.sentiment === 'like' ? <ThumbsUp size={15} /> : <ThumbsDown size={15} />}
                      {t(review.sentiment === 'like' ? 'dishDetail.like' : 'dishDetail.dislike')}
                    </p>
                    {review.manager_reply && (
                      <div className="mt-4 rounded-lg border-l-4 border-basil-500 bg-basil-50 p-3">
                        <p className="text-xs font-semibold text-basil-800">
                          {t('dishDetail.restaurantReply')}{review.manager_name ? ` · ${review.manager_name}` : ''}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{review.manager_reply}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
            </article>
            <aside className="min-w-0" aria-label={t('dishDetail.recommendations')}>
              {!authLoading && (
                <DishRecommendations
                  isCustomer={user?.role === 'customer'}
                  compact
                  excludeDishId={id}
                />
              )}
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
}
