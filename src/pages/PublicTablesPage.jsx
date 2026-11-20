import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { tablesApi } from '../api/tables';
import { getErrorMessage } from '../api/client';
import { RestaurantFloor } from './ReservationPage';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';

export default function PublicTablesPage() {
  const { t } = useCustomerTranslation();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    tablesApi.list()
      .then((res) => {
        if (active) {
          setTables((res.data.tables || []).map((table) => ({ ...table, status: 'trong' })));
        }
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">{t('publicTables.eyebrow')}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{t('publicTables.title')}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('publicTables.description')}
          </p>
        </div>

        <div className="reservation-page">
          <RestaurantFloor
            tables={tables}
            matches={[]}
            selectedTables={[]}
            searched={false}
            loading={loading}
            error={error}
            panelVisible={false}
            onTogglePanel={() => {}}
            onSelect={() => {}}
            showPanelToggle={false}
            preview
            isCustomerFacing
          />
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">{t('publicTables.bookPrompt')}</p>
          <Link to="/login" state={{ from: { pathname: '/tables' } }} className="btn-primary">
            {t('publicTables.loginToBook')}
          </Link>
        </div>
      </div>
    </Layout>
  );
}
