import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { dishesApi } from '../api/dishes';
import { getErrorMessage } from '../api/client';

export default function DishDetailPage() {
  const { id } = useParams();
  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDish() {
      try {
        const response = await dishesApi.getById(id);
        setDish(response.data.dish);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadDish();
  }, [id]);

  return (
    <Layout>
      <Link to="/dishes" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-basil-600">
        <ArrowLeft size={16} />
        Quay lại danh sách món
      </Link>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      )}

      {!loading && error && <Alert type="error">{error}</Alert>}

      {!loading && !error && dish && (
        <article className="max-w-3xl">
          {dish.image_url && (
            <img
              src={dish.image_url}
              alt={dish.name}
              className="h-64 w-full rounded-2xl object-cover sm:h-80"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
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
              </div>
              <p className="font-mono text-lg font-semibold text-ink">
                {Number(dish.price).toLocaleString('vi-VN')}đ
              </p>
            </div>

            {dish.contains_excluded_ingredient && (
              <p className="mt-4 text-amber-600">
                Món này có nguyên liệu bạn muốn tránh.
              </p>
            )}

            {dish.description && <p className="mt-5 text-slate-600">{dish.description}</p>}

            {dish.ingredients?.length > 0 && (
              <section className="mt-6">
                <h2 className="font-display text-base font-semibold text-ink">Nguyên liệu</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {dish.ingredients.map((ingredient) => (
                    <li key={ingredient.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                      {ingredient.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>
      )}
    </Layout>
  );
}
