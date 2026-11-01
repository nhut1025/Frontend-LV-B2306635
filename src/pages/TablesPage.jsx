// src/pages/TablesPage.jsx
//
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Loader2, CheckCircle2, Phone, CalendarClock, UserRound, UtensilsCrossed, MoveRight } from 'lucide-react';
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
  const [recoverableReservations, setRecoverableReservations] = useState([]);
  const [confirmedArrivalIds, setConfirmedArrivalIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [refundCancelTarget, setRefundCancelTarget] = useState(null);
  const [refundDetails, setRefundDetails] = useState({
    refund_bank_code: '',
    refund_account_number: '',
    refund_account_name: '',
  });
  const [billTable, setBillTable] = useState(null);
  const [paymentTable, setPaymentTable] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferTableIds, setTransferTableIds] = useState([]);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');

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
      const res = canOperateTables ? await tablesApi.listOperational() : await tablesApi.list();
      setTables(res.data.tables);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadUpcoming(showSpinner = true) {
    if (!canOperateTables) return;
    if (showSpinner) setUpcomingLoading(true);
    try {
      const res = await reservationsApi.listUpcoming();
      setUpcoming(res.data.upcoming || []);
      setRecoverableReservations(res.data.recoverable || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (showSpinner) setUpcomingLoading(false);
    }
  }

  useEffect(() => {
    loadTables();
    loadUpcoming();
  }, [canOperateTables]);

  useEffect(() => {
    if (!canOperateTables) return undefined;
    const intervalId = setInterval(() => loadUpcoming(false), 30000);
    return () => clearInterval(intervalId);
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
    socket.on('service:table-transferred', refreshOperationalData);
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
          setPaymentTable({
            table: { ...table, table_number: billData.bill.table_number || table.table_number },
            bill: billData.bill,
            items: billData.items,
          });
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

  async function handleReservationAction(reservationId, action, refundAccount = {}) {
    if (action === 'cancel' && !Object.keys(refundAccount).length
      && !confirm('Khách đã trễ ít nhất 15 phút. Hủy sẽ ghi nhận mất cọc; nếu khách đến, có thể khôi phục trong 30 phút sau khi hủy (nếu bàn còn trống). Tiếp tục?')) return;
    const cancellationData = action === 'cancel' && !Object.keys(refundAccount).length
      ? { accept_forfeiture: true }
      : refundAccount;
    setActionId(`reservation-${reservationId}`);
    setError('');
    setSuccess('');
    try {
      const res = action === 'confirm'
        ? await reservationsApi.confirmArrival(reservationId)
        : await reservationsApi.cancelByStaff(reservationId, cancellationData);
      setSuccess(res.data.message);
      if (action === 'confirm') {
        const confirmedId = String(reservationId);
        setConfirmedArrivalIds((ids) => new Set(ids).add(confirmedId));
        setUpcoming((reservations) => reservations.filter(
          (reservation) => String(reservation.id) !== confirmedId
        ));
      }
      await refreshOperationalData();
      return true;
    } catch (err) {
      const message = getErrorMessage(err);
      if (action === 'cancel' && err.response?.status === 409) {
        setRefundCancelTarget(null);
        await refreshOperationalData();
      }
      setError(message);
      return false;
    } finally {
      setActionId(null);
    }
  }

  function startReservationTransfer(reservation) {
    const tableIds = String(reservation.table_ids || '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    setTransferTarget({
      type: 'reservation',
      reservationId: Number(reservation.id),
      partySize: Number(reservation.party_size),
      tableIds,
    });
    setTransferTableIds([]);
    setTransferError('');
  }

  function startOccupiedTransfer(table) {
    if (table.current_reservation_id) {
      const tableIds = tables
        .filter((item) => Number(item.current_reservation_id) === Number(table.current_reservation_id))
        .map((item) => Number(item.id));
      setTransferTarget({
        type: 'reservation',
        reservationId: Number(table.current_reservation_id),
        partySize: Number(table.current_reservation_party_size),
        tableIds,
      });
      setTransferTableIds([]);
    } else {
      setTransferTarget({ type: 'walk-in', tableId: Number(table.id), tableNumber: table.table_number });
      setTransferTableIds([]);
    }
    setTransferError('');
    setSelectedTable(null);
  }

  function closeTransferModal() {
    if (transferSaving) return;
    setTransferTarget(null);
    setTransferTableIds([]);
  }

  function toggleTransferTable(tableId) {
    const id = Number(tableId);
    setTransferTableIds((ids) => (
      ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]
    ));
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();
    if (!transferTarget) return;
    setTransferSaving(true);
    setTransferError('');
    setSuccess('');
    try {
      const response = transferTarget.type === 'reservation'
        ? await reservationsApi.transferTables(transferTarget.reservationId, transferTableIds)
        : await tablesApi.transfer(transferTarget.tableId, transferTableIds[0]);
      setSuccess(response.data.message);
      setTransferTarget(null);
      setTransferTableIds([]);
      await refreshOperationalData();
    } catch (err) {
      setTransferError(getErrorMessage(err));
      if (err.response?.status === 409) await refreshOperationalData();
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleRestoreReservation(reservationId) {
    if (!confirm('Khôi phục đặt bàn và tiền cọc cho khách? Hệ thống sẽ giữ bàn cũ nếu còn trống, hoặc chọn bàn trống phù hợp khác.')) return;
    setActionId(`restore-${reservationId}`);
    setError('');
    setSuccess('');
    try {
      const res = await reservationsApi.restoreAfterStaffCancel(reservationId);
      setSuccess(res.data.message);
      await refreshOperationalData();
    } catch (err) {
      setError(getErrorMessage(err));
      if (err.response?.status === 409) await refreshOperationalData();
    } finally {
      setActionId(null);
    }
  }

  function requestReservationCancellation(reservation) {
    if (Number(reservation.preorder_prepared)) {
      setError('Không thể hủy vì món đặt trước đã được đưa vào bill và gửi xuống bếp.');
      return;
    }
    if (Number(reservation.cancel_refund_eligible)) {
      setRefundDetails({ refund_bank_code: '', refund_account_number: '', refund_account_name: '' });
      setRefundCancelTarget(reservation);
      return;
    }
    handleReservationAction(reservation.id, 'cancel');
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
              <p className="text-sm text-slate-500">Chỉ hủy khi khách đã trễ ít nhất 15 phút</p>
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
          ) : visibleUpcoming.length === 0 && recoverableReservations.length === 0 ? (
            <div className="card text-center text-sm text-slate-500">Không có đặt bàn sắp tới.</div>
          ) : (
            <div className="space-y-3">
              {visibleUpcoming.map((reservation) => (
                <div key={reservation.id} className="card flex flex-wrap items-center justify-between gap-4">
                  <div>
                    {Number(reservation.late_cancel_eligible) > 0 && (
                      <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        Khách đã trễ quá 15 phút. Nhân viên có thể chủ động hủy; tiền cọc sẽ bị mất.
                      </div>
                    )}
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
                      onClick={() => startReservationTransfer(reservation)}
                      disabled={actionId === `reservation-${reservation.id}`}
                      className="btn-secondary"
                    >
                      <MoveRight size={16} />
                      Chuyển bàn
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReservationAction(reservation.id, 'confirm')}
                      disabled={actionId === `reservation-${reservation.id}`}
                      className="btn-primary"
                    >
                      {actionId === `reservation-${reservation.id}` ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Xác nhận khách đến
                    </button>
                    {Number(reservation.late_cancel_eligible) > 0 && (
                      <button
                        type="button"
                        onClick={() => requestReservationCancellation(reservation)}
                        disabled={actionId === `reservation-${reservation.id}` || Number(reservation.preorder_prepared)}
                        className="btn-secondary border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        Hủy đặt bàn
                      </button>
                    )}
                    {Number(reservation.preorder_prepared) > 0 && (
                      <span className="self-center text-xs text-slate-500">
                        Món đã vào bill/bếp, không thể hủy
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {recoverableReservations.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 font-semibold text-ink">Đơn đã hủy — còn thời gian khôi phục</h3>
                  <div className="space-y-3">
                    {recoverableReservations.map((reservation) => (
                      <div key={reservation.id} className="card flex flex-wrap items-center justify-between gap-4 border-amber-300 bg-amber-50">
                        <div>
                          <p className="font-medium text-ink">
                            {reservation.customer_name || 'Khách đặt bàn'} · Đơn #{reservation.id}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Bàn {reservation.table_numbers || '—'} · Hủy lúc {reservation.cancelled_at}
                          </p>
                          <p className="mt-1 text-sm font-medium text-amber-800">
                            Cọc {Number(reservation.deposit_amount || 0).toLocaleString('vi-VN')}đ đang ghi nhận mất; có thể khôi phục trong 30 phút nếu còn bàn phù hợp.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreReservation(reservation.id)}
                          disabled={actionId === `restore-${reservation.id}`}
                          className="btn-primary"
                        >
                          {actionId === `restore-${reservation.id}` && <Loader2 size={16} className="animate-spin" />}
                          Khôi phục đặt bàn
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <button
                type="button"
                onClick={() => startOccupiedTransfer(selectedTable)}
                className="btn-secondary w-full"
              >
                <MoveRight size={16} />
                Chuyển khách sang bàn khác
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

      {transferTarget && (
        <Modal
          title={transferTarget.type === 'reservation' ? 'Chuyển bàn đặt trước' : `Chuyển khách từ bàn ${transferTarget.tableNumber}`}
          onClose={closeTransferModal}
        >
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
              {transferTarget.type === 'reservation'
                ? `Bàn hiện tại: ${tables
                  .filter((table) => transferTarget.tableIds.includes(Number(table.id)))
                  .map((table) => table.table_number)
                  .join(' + ')}. Chọn đầy đủ nhóm bàn đích, tổng sức chứa phải ít nhất ${transferTarget.partySize} khách.`
                : 'Chọn một bàn trống để chuyển khách. Nhân viên chịu trách nhiệm xác nhận sức chứa phù hợp.'}
            </p>

            {transferTarget.type === 'reservation' ? (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {tables
                  .filter((table) => (
                    table.status === 'trong' || transferTarget.tableIds.includes(Number(table.id))
                  ))
                  .map((table) => (
                    <label key={table.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={transferTableIds.includes(Number(table.id))}
                        onChange={() => toggleTransferTable(table.id)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      <span className="flex-1 text-sm font-medium text-ink">
                        Bàn {table.table_number}
                        {transferTarget.tableIds.includes(Number(table.id)) && (
                          <span className="ml-2 text-xs font-normal text-slate-500">bàn hiện tại</span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">{table.capacity} chỗ</span>
                    </label>
                  ))}
              </div>
            ) : (
              <label className="block">
                <span className="field-label">Bàn chuyển đến</span>
                <select
                  required
                  value={transferTableIds[0] || ''}
                  onChange={(event) => setTransferTableIds(event.target.value ? [Number(event.target.value)] : [])}
                  className="field-input"
                >
                  <option value="" disabled>— Chọn bàn trống —</option>
                  {tables
                    .filter((table) => table.status === 'trong' && Number(table.id) !== transferTarget.tableId)
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        Bàn {table.table_number} · {table.capacity} chỗ
                      </option>
                    ))}
                </select>
              </label>
            )}

            {transferTarget.type === 'reservation' && (
              <p className={`text-sm font-medium ${
                transferTableIds.reduce((capacity, id) => (
                  capacity + Number(tables.find((table) => Number(table.id) === id)?.capacity || 0)
                ), 0) >= transferTarget.partySize ? 'text-emerald-700' : 'text-clay-600'
              }`}>
                Tổng sức chứa đã chọn: {transferTableIds.reduce((capacity, id) => (
                  capacity + Number(tables.find((table) => Number(table.id) === id)?.capacity || 0)
                ), 0)} / {transferTarget.partySize} khách
              </p>
            )}
            {transferError && <Alert type="error">{transferError}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeTransferModal} disabled={transferSaving}>
                Hủy
              </button>
              <button
                type="submit"
                disabled={transferSaving || transferTableIds.length === 0 || (
                  transferTarget.type === 'reservation'
                  && transferTableIds.reduce((capacity, id) => (
                    capacity + Number(tables.find((table) => Number(table.id) === id)?.capacity || 0)
                  ), 0) < transferTarget.partySize
                )}
                className="btn-primary"
              >
                {transferSaving ? <Loader2 size={16} className="animate-spin" /> : <MoveRight size={16} />}
                Xác nhận chuyển bàn
              </button>
            </div>
          </form>
        </Modal>
      )}

      {refundCancelTarget && (
        <Modal title={`Hủy đặt bàn #${refundCancelTarget.id}`} onClose={() => setRefundCancelTarget(null)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleReservationAction(refundCancelTarget.id, 'cancel', refundDetails)
                .then((succeeded) => {
                  if (succeeded) setRefundCancelTarget(null);
                });
            }}
          >
            <p className="text-sm text-slate-600">
              Đơn đủ điều kiện hoàn 100% tiền cọc. Nhập tài khoản khách để quản lý chuyển khoản hoàn tiền.
            </p>
            <label className="block">
              <span className="field-label">Ngân hàng</span>
              <input required maxLength={20} className="field-input" value={refundDetails.refund_bank_code}
                onChange={(event) => setRefundDetails((value) => ({ ...value, refund_bank_code: event.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">Số tài khoản</span>
              <input required maxLength={50} className="field-input" value={refundDetails.refund_account_number}
                onChange={(event) => setRefundDetails((value) => ({ ...value, refund_account_number: event.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">Tên chủ tài khoản</span>
              <input required maxLength={100} className="field-input" value={refundDetails.refund_account_name}
                onChange={(event) => setRefundDetails((value) => ({ ...value, refund_account_name: event.target.value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRefundCancelTarget(null)}>Đóng</button>
              <button type="submit" disabled={actionId === `reservation-${refundCancelTarget.id}`} className="btn-primary">
                {actionId === `reservation-${refundCancelTarget.id}` && <Loader2 size={15} className="animate-spin" />}
                Hủy và gửi yêu cầu hoàn
              </button>
            </div>
          </form>
        </Modal>
      )}

      {billTable && (
        <Modal
          title={`Gọi món — ${billTable.current_reservation_id
            ? `Nhóm bàn ${tables
              .filter((table) => Number(table.current_reservation_id) === Number(billTable.current_reservation_id))
              .map((table) => table.table_number)
              .join(' + ')}`
            : `Bàn ${billTable.table_number}`}`}
          onClose={() => setBillTable(null)}
          widthClass="max-w-md"
        >
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
