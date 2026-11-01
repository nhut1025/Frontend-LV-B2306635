import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { tablesApi } from '../api/tables';
import { getErrorMessage } from '../api/client';
import { RestaurantFloor } from './ReservationPage';

export default function PublicTablesPage() {
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
          <p className="text-xs font-semibold uppercase tracking-widest text-basil-700">Không gian quán</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Sơ đồ bàn nhà hàng</h1>
          <p className="mt-2 text-sm text-slate-500">
            Bạn có thể xem cách bố trí bàn. Đăng nhập để tìm bàn trống và gửi yêu cầu đặt bàn.
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
          />
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">Muốn chọn ngày, giờ và đặt bàn? Vui lòng đăng nhập trước.</p>
          <Link to="/login" state={{ from: { pathname: '/tables' } }} className="btn-primary">
            Đăng nhập để đặt bàn
          </Link>
        </div>
      </div>
    </Layout>
  );
}
