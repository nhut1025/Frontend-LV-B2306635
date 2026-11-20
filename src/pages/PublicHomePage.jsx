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
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import { formatCurrency, formatDate } from '../i18n/formatters';

function RatingStars({ value, locale }) {
  const { t } = useCustomerTranslation();
  const rating = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={t('home.ratingStars', {
      rating: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value)),
    })}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={16} fill={index < rating ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function PublicHomePage() {
  const { t, locale } = useCustomerTranslation();
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
        nextErrors.push({ kind: 'menu', detail: getErrorMessage(results[0].reason) });
      }
      if (results[1].status === 'fulfilled') {
        setReviews(results[1].value.data);
      } else {
        nextErrors.push({ kind: 'reviews', detail: getErrorMessage(results[1].reason) });
      }
      if (results[2].status === 'fulfilled') {
        setTables((results[2].value.data.tables || []).map((table) => ({ ...table, status: 'trong' })));
      } else {
        nextErrors.push({ kind: 'map', detail: getErrorMessage(results[2].reason) });
      }
      setErrors(nextErrors);
      setLoading(false);
    }

    loadPublicContent();
    return () => { active = false; };
  }, []);

  const featuredDishes = dishes.slice(0, 6);
  const recentReviews = reviews?.reviews?.slice(0, 3) || [];
  const dishesFailed = errors.some((error) => error.kind === 'menu');
  const reviewsFailed = errors.some((error) => error.kind === 'reviews');

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-12 pb-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-basil-700 via-basil-600 to-emerald-800 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-basil-100">{t('home.welcome')}</p>
          <div className="mt-4 grid items-center gap-8 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-5xl">
                {t('home.heroTitle')}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-basil-50 sm:text-base">
                {t('home.heroDescription')}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/dishes" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-basil-700 hover:bg-basil-50">
                  <UtensilsCrossed size={17} /> {t('home.exploreMenu')}
                </Link>
                <Link to="/tables" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  <CalendarDays size={17} /> {t('home.bookTable')}
                </Link>
              </div>
              <p className="mt-3 text-xs text-basil-100">{t('home.loginRequired')}</p>
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
            {errors.map((error) => (
              <Alert key={error.kind} type="error">
                {t(`home.load${error.kind === 'menu' ? 'Menu' : error.kind === 'reviews' ? 'Reviews' : 'Map'}Error`)}: {error.detail}
              </Alert>
            ))}
          </div>
        )}

        <section aria-labelledby="public-space-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">{t('home.restaurantSpace')}</p>
            <h2 id="public-space-heading" className="mt-1 font-display text-2xl font-semibold text-ink">
              {t('home.exploreFloorPlan')}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {t('home.floorPlanDescription')}
            </p>
          </div>
          <div className="reservation-page">
            <RestaurantFloor
              tables={tables}
              matches={[]}
              selectedTables={[]}
              searched={false}
              loading={loading}
              error={errors.some((error) => error.kind === 'map') ? t('home.mapUnavailable') : ''}
              panelVisible={false}
              onTogglePanel={() => {}}
              onSelect={() => {}}
              showPanelToggle={false}
              preview
              isCustomerFacing
            />
          </div>
        </section>

        <section aria-labelledby="public-dishes-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">{t('home.kitchen')}</p>
              <h2 id="public-dishes-heading" className="mt-1 font-display text-2xl font-semibold text-ink">{t('home.featuredDishes')}</h2>
            </div>
            <Link to="/dishes" className="inline-flex items-center gap-1 text-sm font-semibold text-basil-700 hover:text-basil-800">
              {t('home.viewFullMenu')} <ArrowRight size={16} />
            </Link>
          </div>
          {loading && dishes.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : dishesFailed ? (
            <div className="card text-sm text-slate-500">{t('home.menuUnavailable')}</div>
          ) : featuredDishes.length === 0 ? (
            <div className="card text-sm text-slate-500">{t('home.noDishes')}</div>
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
                      {formatCurrency(dish.price, locale)}
                    </span>
                  </div>
                  {dish.description && <p className="line-clamp-2 text-sm text-slate-500">{dish.description}</p>}
                  <Link to={`/dishes/${dish.id}`} className="mt-auto text-sm font-semibold text-basil-700 hover:text-basil-800">
                    {t('home.viewDish')} <ArrowRight size={14} className="ml-1 inline" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="public-reviews-heading" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">{t('home.guestsShare')}</p>
              <h2 id="public-reviews-heading" className="mt-1 font-display text-2xl font-semibold text-ink">{t('home.restaurantReviews')}</h2>
            </div>
            <Link to="/restaurant-reviews" className="inline-flex items-center gap-1 text-sm font-semibold text-basil-700 hover:text-basil-800">
              {t('home.viewAllReviews')} <ArrowRight size={16} />
            </Link>
          </div>

          {reviews?.summary && (
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-basil-50 p-4">
              <span className="font-display text-3xl font-semibold text-ink">
                {new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(reviews.summary.average_rating)}
              </span>
              <RatingStars value={reviews.summary.average_rating} locale={locale} />
              <span className="text-sm text-slate-600">
                {t('home.reviewCount', {
                  count: reviews.summary.review_count,
                  formattedCount: new Intl.NumberFormat(locale).format(reviews.summary.review_count),
                })}
              </span>
            </div>
          )}

          {loading && !reviews ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : reviewsFailed ? (
            <div className="py-6 text-center text-sm text-slate-500">{t('home.reviewUnavailable')}</div>
          ) : recentReviews.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {recentReviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <RatingStars value={review.rating} locale={locale} />
                    <time className="text-xs text-slate-400">{formatDate(review.paid_at || review.created_at, locale)}</time>
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.comment}</p>
                  {review.manager_reply && (
                    <p className="mt-3 line-clamp-3 rounded-lg bg-basil-50 p-3 text-xs leading-5 text-basil-900">
                      <span className="font-semibold">{t('home.restaurantReply')}</span>{review.manager_reply}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">
              <MessageSquareQuote className="mx-auto mb-2 text-slate-300" size={26} />
              {t('home.noReviews')}
            </div>
          )}
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-basil-100 bg-basil-50 p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{t('home.readyToVisit')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('home.loginToBook')}</p>
          </div>
          <Link to="/tables" className="btn-primary shrink-0">
            <CalendarDays size={16} /> {t('home.bookNow')}
          </Link>
        </section>
      </div>
    </Layout>
  );
}
