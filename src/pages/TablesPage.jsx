// src/pages/TablesPage.jsx
//
// Signature visual: mỗi bàn được vẽ như 1 cái đĩa (2 vòng tròn lồng nhau,
// viền ngoài là "khăn lót", vòng trong là "đĩa"), màu vòng trong đổi theo
// trạng thái bàn — ẩn dụ trực quan gắn với chủ đề quán ăn.

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { tablesApi } from '../api/tables';
import { getErrorMessage } from '../api/client';

const STATUS_CONFIG = {
  trong: { label: 'Trống', ring: 'bg-basil-50 border-basil-200', dot: 'bg-basil-500' },
  giu_tam: { label: 'Giữ tạm', ring: 'bg-saffron-50 border-saffron-400', dot: 'bg-saffron-500' },
  da_dat: { label: 'Đã đặt', ring: 'bg-slate-50 border-slate-400', dot: 'bg-slate-500' },
  co_khach: { label: 'Có khách', ring: 'bg-clay-50 border-clay-400', dot: 'bg-clay-500' },
};

const emptyForm = { table_number: '', capacity: '' };

export default function TablesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    loadTables();
  }, []);

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

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Sơ đồ bàn</h1>
          <p className="text-sm text-slate-500">Trạng thái các bàn trong quán</p>
        </div>
        {isManager && (
          <button onClick={openCreateModal} className="btn-primary">
            <Plus size={16} />
            Thêm bàn
          </button>
        )}
      </div>

      {/* Chú thích trạng thái */}
      <div className="mb-6 flex flex-wrap gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>
        ))}
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : tables.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Chưa có bàn nào.</div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map((table) => {
            const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.trong;
            return (
              <div key={table.id} className="group flex flex-col items-center gap-2">
                {/* "Khăn lót" — vòng ngoài trung tính */}
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-100 p-2.5 shadow-sm">
                  {/* "Đĩa" — vòng trong đổi màu theo trạng thái */}
                  <div className={`flex h-full w-full flex-col items-center justify-center rounded-full border-4 ${cfg.ring}`}>
                    <span className="font-mono text-lg font-semibold text-ink">{table.table_number}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Users size={12} />
                      {table.capacity}
                    </span>
                  </div>

                  {isManager && (
                    <div className="absolute -bottom-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEditModal(table)}
                        className="rounded-full bg-white p-1.5 text-slate-400 shadow hover:text-basil-600"
                        aria-label="Sửa bàn"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(table)}
                        className="rounded-full bg-white p-1.5 text-slate-400 shadow hover:text-clay-500"
                        aria-label="Xoá bàn"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-500">{cfg.label}</span>
              </div>
            );
          })}
        </div>
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
