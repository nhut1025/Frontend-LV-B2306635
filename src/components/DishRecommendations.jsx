import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { recommendationsApi } from '../api/recommendations';
import { getErrorMessage } from '../api/client';

function RecommendationGrid({ recommendations, compact = false }) {
  return (
    <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'}>
      {recommendations.map((dish) => (
        <article
          key={dish.dish_id}
          className={`flex min-w-0 gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-basil-200 hover:shadow-sm ${
            compact ? 'items-center' : 'flex-col'
          }`}
        >
          <Link
            to={`/dishes/${dish.dish_id}`}
            aria-label={`Xem món ${dish.name}`}
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ${
              compact ? 'h-20 w-24' : 'aspect-[4/3]'
            }`}
          >
            {dish.image_url ? (
              <img
                src={dish.image_url}
                alt={dish.name}
                className="h-full w-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <UtensilsCrossed size={30} className="text-basil-500" aria-hidden="true" />
            )}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-semibold uppercase tracking-wide text-basil-700">
              {dish.category || 'Món ngon'}
            </p>
            <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold text-ink">
              {dish.name}
            </h3>
            <p className="mt-2 font-mono text-sm font-semibold text-ink">
              {Number(dish.price).toLocaleString('vi-VN')}đ
            </p>
            <Link
              to={`/dishes/${dish.dish_id}`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-basil-700 hover:text-basil-800"
            >
              Xem món <ArrowRight size={15} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function DishRecommendations({
  isCustomer,
  compact = false,
  excludeDishId,
}) {
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState([]);
  const [popularRecommendations, setPopularRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadRecommendations() {
      setLoading(true);
      setError('');
      setPersonalizedRecommendations([]);
      setPopularRecommendations([]);

      try {
        let personalizedResponse = null;
        let popularResponse;
        if (isCustomer) {
          [personalizedResponse, popularResponse] = await Promise.all([
            recommendationsApi.mine({ model: 'content_based', limit: 8 }),
            recommendationsApi.list({ model: 'popularity', limit: 16 }),
          ]);
        } else {
          popularResponse = await recommendationsApi.list({ model: 'popularity', limit: 8 });
        }

        const personalizedData = personalizedResponse?.data;
        const popularData = popularResponse.data;
        if (
          (personalizedData && !Array.isArray(personalizedData.recommendations))
          || !Array.isArray(popularData?.recommendations)
        ) {
          throw new Error('Dữ liệu gợi ý món ăn không hợp lệ.');
        }
        if (active) {
          const isVisibleDish = (dish) => (
            excludeDishId == null || Number(dish.dish_id) !== Number(excludeDishId)
          );
          const personalized = personalizedData?.model === 'content_based'
            ? personalizedData.recommendations
              .filter(isVisibleDish)
            : [];
          const personalizedDishIds = new Set(personalized.map((dish) => dish.dish_id));
          const popular = popularData.recommendations
            .filter(isVisibleDish)
            .filter((dish) => !personalizedDishIds.has(dish.dish_id))
            .slice(0, 8);
          setPersonalizedRecommendations(personalized);
          setPopularRecommendations(popular);
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecommendations();
    return () => { active = false; };
  }, [excludeDishId, isCustomer, reloadKey]);

  const sidebarRecommendations = [
    ...personalizedRecommendations,
    ...popularRecommendations,
  ].slice(0, 6);

  return (
    <section
      aria-labelledby="dish-recommendations-heading"
      className="overflow-hidden rounded-3xl border border-basil-100 bg-white shadow-sm"
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 bg-basil-50 ${
        compact ? 'px-4 py-4' : 'px-5 py-5 sm:px-7'
      }`}>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-basil-700">
            <Sparkles size={15} aria-hidden="true" />
            {isCustomer ? 'Dành riêng cho bạn' : 'Món được yêu thích'}
          </p>
          <h2
            id="dish-recommendations-heading"
            className={`mt-1 font-display font-semibold text-ink ${
              compact ? 'text-lg' : 'text-xl sm:text-2xl'
            }`}
          >
            Gợi ý món ăn
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {loading
              ? 'Đang tìm món phù hợp...'
              : isCustomer
                ? 'Gợi ý cá nhân và các món phổ biến trong quán'
                : 'Món phổ biến trong quán'}
          </p>
        </div>
        {!isCustomer && (
          <Link
            to="/login"
            className="text-sm font-semibold text-basil-700 hover:text-basil-800"
          >
            Đăng nhập để nhận gợi ý cá nhân
          </Link>
        )}
      </div>

      <div className={compact ? 'p-3 sm:p-4' : 'p-5 sm:p-7'}>
        {loading ? (
          <div className="flex justify-center py-8" role="status" aria-live="polite">
            <Loader2 className="animate-spin text-basil-600" size={24} />
            <span className="sr-only">Đang tải gợi ý món ăn</span>
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-clay-50 p-4 text-sm text-clay-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="inline-flex items-center gap-2 font-semibold hover:text-clay-800"
            >
              <RefreshCw size={15} />
              Thử lại
            </button>
          </div>
        ) : (compact
          ? sidebarRecommendations.length === 0
          : personalizedRecommendations.length === 0 && popularRecommendations.length === 0) ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Hiện chưa có món phù hợp để gợi ý. Bạn có thể xem toàn bộ thực đơn bên dưới.
          </p>
        ) : compact ? (
          <RecommendationGrid recommendations={sidebarRecommendations} compact />
        ) : (
          <div className="space-y-7">
            {personalizedRecommendations.length > 0 && (
              <section aria-labelledby="personalized-recommendations-heading">
                <h3
                  id="personalized-recommendations-heading"
                  className="mb-3 font-display text-lg font-semibold text-ink"
                >
                  Gợi ý theo sở thích của bạn
                </h3>
                <RecommendationGrid recommendations={personalizedRecommendations} />
              </section>
            )}
            {popularRecommendations.length > 0 && (
              <section aria-labelledby="popular-recommendations-heading">
                <h3
                  id="popular-recommendations-heading"
                  className="mb-3 font-display text-lg font-semibold text-ink"
                >
                  Món phổ biến trong quán
                </h3>
                <RecommendationGrid recommendations={popularRecommendations} />
              </section>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
