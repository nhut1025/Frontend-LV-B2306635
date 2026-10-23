// src/pages/TablesPage.jsx
//
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Loader2, CheckCircle2, Phone, CalendarClock, UserRound, UtensilsCrossed } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import BillPanel from '../components/BillPanel';
import ReadyItemsPanel from '../components/ReadyItemsPanel';
import WaiterPaymentModal from '../components/WaiterPaymentModal';
import ReservationPage, { RestaurantFloor } from './ReservationPage';
import { useAuth } from '../context/AuthContext';
import { tablesApi } from '../api/tables';
import { billsApi } from '../api/bills';
import { reservationsApi } from '../api/reservations';
import { createSocket } from '../api/socket';
import { getErrorMessage } from '../api/client';

const STATUS_CONFIG = {
  trong: { label: 'Trống', border: 'border-basil-500', text: 'text-basil-700', dot: 'bg-basil-500' },
  giu_tam: { label: 'Giữ tạm', border: 'border-yellow-400', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  da_dat: { label: 'Đã đặt', border: 'border-orange-400', text: 'text-orange-700', dot: 'bg-orange-500' },
  co_khach: { label: 'Có khách', border: 'border-red-500', text: 'text-red-700', dot: 'bg-red-500' },
};

const emptyForm = { table_number: '', capacity: '' };

export default function TablesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const canOperateTables = user?.role === 'phuc_vu';

  const [tables, setTables] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [confirmedArrivalIds, setConfirmedArrivalIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [billTable, setBillTable] = useState(null);
  const [paymentTable, setPaymentTable] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const visibleUpcoming = upcoming.filter((reservation) => !confirmedArrivalIds.has(String(reservation.id)));
  const selectedReservation = selectedTable && upcoming.find((reservation) =>
    String(reservation.table_ids || '')
      .split(',')
      .map((tableId) => tableId.trim())
      .includes(String(selectedTable.id))
  );

  async function loadTables() {
    setLoading(true);
    setError('');
    try {
      const res = await tablesApi.list();
      setTables(res.data.tables);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadUpcoming() {
    if (!canOperateTables) return;
    setUpcomingLoading(true);
    try {
      const res = await reservationsApi.listUpcoming();
      setUpcoming(res.data.upcoming || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpcomingLoading(false);
    }
  }

  useEffect(() => {
    loadTables();
    loadUpcoming();
  }, [canOperateTables]);

  useEffect(() => {
    if (!canOperateTables) return undefined;
    const socket = createSocket();
    socket.on('service:bill-paid', (bill) => {
      sessionStorage.removeItem(`payment-request-${bill.bill_id}`);
      setPaymentTable((current) => (current?.bill.id === bill.bill_id ? null : current));
      setSuccess(`Bàn ${bill.table_id}: thu ngân đã xác nhận thanh toán. Khách có thể rời bàn.`);
      refreshOperationalData();
    });
    return () => socket.disconnect();
  }, [canOperateTables]);

  async function refreshOperationalData() {
    await Promise.all([loadTables(), loadUpcoming()]);
  }

  async function handleTableAction(table) {
    if (!canOperateTables || !['trong', 'co_khach'].includes(table.status)) return;
    setActionId(`table-${table.id}`);
    setError('');
    setSuccess('');
    try {
      if (table.status === 'co_khach') {
        let billData;
        try {
          const billRes = await billsApi.getByTable(table.id);
          billData = billRes.data;
        } catch (err) {
          if (err.response?.status !== 404) throw err;
        }
        if ((billData?.items || []).length > 0) {
          setPaymentTable({ table, bill: billData.bill, items: billData.items });
          setSelectedTable(null);
          return;
        }
        const releaseRes = await tablesApi.release(table.id);
        setSuccess(releaseRes.data.message);
        setSelectedTable(null);
        await refreshOperationalData();
        return;
      }

      const res = await tablesApi.walkIn(table.id);
      setSuccess(res.data.message);
      setSelectedTable(null);
      await refreshOperationalData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  async function handleReservationAction(reservationId, action) {
    if (action === 'cancel' && !confirm('Bạn có chắc muốn hủy đặt bàn này? Các bàn liên quan sẽ được giải phóng.')) return;
    setActionId(`reservation-${reservationId}`);
    setError('');
    setSuccess('');
    try {
      const res = action === 'confirm'
        ? await reservationsApi.confirmArrival(reservationId)
        : await reservationsApi.cancelByStaff(reservationId);
      setSuccess(res.data.message);
      if (action === 'confirm') {
        const confirmedId = String(reservationId);
        setConfirmedArrivalIds((ids) => new Set(ids).add(confirmedId));
        setUpcoming((reservations) => reservations.filter(
          (reservation) => String(reservation.id) !== confirmedId
        ));
      }
      await refreshOperationalData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  function openCreateModal() {
    setEditingTable(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(table) {
    setEditingTable(table);
    setForm({ table_number: table.table_number, capacity: table.capacity });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { table_number: form.table_number, capacity: Number(form.capacity) };
      if (editingTable) {
        await tablesApi.update(editingTable.id, payload);
      } else {
        await tablesApi.create(payload);
      }
      setShowModal(false);
      await loadTables();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(table) {
    if (!confirm(`Xoá bàn ${table.table_number}?`)) return;
    try {
      await tablesApi.remove(table.id);
      await loadTables();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (user?.role === 'customer') {
    return (
      <Layout>
        <ReservationPage embedded tables={tables} loading={loading} tablesError={error} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{user?.role === 'customer' ? 'Bàn & đặt bàn' : 'Sơ đồ bàn'}</h1>
          <p className="text-sm text-slate-500">Trạng thái các bàn trong quán</p>
        </div>
        {isManager && (
          <button onClick={openCreateModal} className="btn-primary">
            <Plus size={16} />
            Thêm bàn
          </button>
        )}
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}
      {canOperateTables && <ReadyItemsPanel />}

      <div className="reservation-page reservation-floor-only">
        <RestaurantFloor
          tables={tables}
          matches={[]}
          selectedTables={selectedTable ? [selectedTable] : []}
          searched={false}
          loading={loading}
          error={!loading && tables.length === 0 ? error : ''}
          interactive
          showPanelToggle={false}
          onSelect={setSelectedTable}
        />
      </div>

      {canOperateTables && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Đặt bàn sắp tới</h2>
              <p className="text-sm text-slate-500">Xác nhận khi khách đến hoặc hủy trực tiếp tại quầy</p>
            </div>
            <button
              type="button"
              onClick={() => { setSuccess(''); loadUpcoming(); }}
              className="btn-secondary"
              disabled={upcomingLoading}
            >
              {upcomingLoading ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
              Làm mới
            </button>
          </div>

          {upcomingLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : visibleUpcoming.length === 0 ? (
            <div className="card text-center text-sm text-slate-500">Không có đặt bàn sắp tới.</div>
          ) : (
            <div className="space-y-3">
              {visibleUpcoming.map((reservation) => (
                <div key={reservation.id} className="card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <UserRound size={16} /> {reservation.customer_name || 'Khách đặt bàn'}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span><Users size={14} className="mr-1 inline" />{reservation.party_size} khách</span>
                      <span><Phone size={14} className="mr-1 inline" />{reservation.phone}</span>
                      <span>{reservation.reservation_date} lúc {reservation.reservation_time?.slice(0, 5)}</span>
                      <span>Bàn {reservation.table_numbers || '—'}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleReservationAction(reservation.id, 'confirm')}
                      disabled={actionId === `reservation-${reservation.id}`}
                      className="btn-primary"
                    >
                      {actionId === `reservation-${reservation.id}` ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Xác nhận khách đến
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReservationAction(reservation.id, 'cancel')}
                      disabled={actionId === `reservation-${reservation.id}`}
                      className="btn-secondary text-clay-600"
                    >
                      Hủy đặt bàn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedTable && (
        <Modal title={`Bàn ${selectedTable.table_number}`} onClose={() => setSelectedTable(null)} widthClass="max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Trạng thái</span>
              <span className="font-medium text-ink">{STATUS_CONFIG[selectedTable.status]?.label || selectedTable.status}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Sức chứa</span>
              <span className="font-medium text-ink">{selectedTable.capacity} khách</span>
            </div>

            {isManager && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const table = selectedTable;
                    setSelectedTable(null);
                    openEditModal(table);
                  }}
                  className="btn-secondary w-full"
                >
                  <Pencil size={15} />
                  Sửa bàn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const table = selectedTable;
                    setSelectedTable(null);
                    handleDelete(table);
                  }}
                  className="btn-secondary w-full text-clay-600"
                >
                  <Trash2 size={15} />
                  Xoá bàn
                </button>
              </div>
            )}

            {selectedTable.status === 'giu_tam' && <Alert type="info">Đang giữ chỗ</Alert>}
            {selectedTable.status === 'da_dat' && (
              <div className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
                <p className="font-medium">Bàn đã có khách đặt</p>
                {(selectedReservation?.customer_name || selectedTable.customer_name || selectedReservation?.phone || selectedTable.phone) && (
                  <p className="mt-1">
                    {selectedReservation?.customer_name || selectedTable.customer_name}
                    {(selectedReservation?.phone || selectedTable.phone) && ` · ${selectedReservation?.phone || selectedTable.phone}`}
                  </p>
                )}
              </div>
            )}
            {selectedTable.status === 'trong' && canOperateTables && (
              <button type="button" onClick={() => handleTableAction(selectedTable)} disabled={actionId === `table-${selectedTable.id}`} className="btn-primary w-full">
                {actionId === `table-${selectedTable.id}` && <Loader2 size={16} className="animate-spin" />}
                Nhận khách vãng lai
              </button>
            )}
            {selectedTable.status === 'co_khach' && canOperateTables && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setBillTable(selectedTable); setSelectedTable(null); }}
                className="btn-primary w-full"
              >
                <UtensilsCrossed size={16} />
                Gọi món
              </button>
              <button type="button" onClick={() => handleTableAction(selectedTable)} disabled={actionId === `table-${selectedTable.id}`} className="btn-secondary w-full">
                {actionId === `table-${selectedTable.id}` && <Loader2 size={16} className="animate-spin" />}
                Trả bàn / thanh toán
              </button>
            </div>
          )}
          </div>
        </Modal>
      )}

      {billTable && (
        <Modal title={`Gọi món — Bàn ${billTable.table_number}`} onClose={() => setBillTable(null)} widthClass="max-w-md">
          <BillPanel tableId={billTable.id} canEdit={canOperateTables} />
        </Modal>
      )}

      {paymentTable && (
        <WaiterPaymentModal
          table={paymentTable.table}
          bill={paymentTable.bill}
          items={paymentTable.items}
          onClose={() => setPaymentTable(null)}
        />
      )}

      {showModal && (
        <Modal title={editingTable ? 'Sửa bàn' : 'Thêm bàn'} onClose={() => setShowModal(false)} widthClass="max-w-sm">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="field-label">Số bàn</label>
              <input
                required
                value={form.table_number}
                onChange={(e) => setForm((f) => ({ ...f, table_number: e.target.value }))}
                className="field-input"
                placeholder="A01"
              />
            </div>
            <div>
              <label className="field-label">Sức chứa (số khách)</label>
              <input
                type="number"
                required
                min="1"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                className="field-input"
                placeholder="4"
              />
              <p className="mt-1 text-xs text-slate-400">Giá trị hợp lệ do quán cấu hình (mặc định 1–16).</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                Huỷ
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
