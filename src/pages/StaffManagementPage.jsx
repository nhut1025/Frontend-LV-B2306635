// src/pages/StaffManagementPage.jsx
import { useEffect, useState } from 'react';
import { Plus, Pencil, Lock, Unlock, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { staffApi } from '../api/staff';
import { getErrorMessage } from '../api/client';

const ROLE_LABELS = {
  phuc_vu: 'Phục vụ',
  thu_ngan: 'Thu ngân',
  kitchen: 'Bếp',
  manager: 'Quản lý',
};

const emptyCreateForm = { full_name: '', email: '', password: '', phone: '', role: 'phuc_vu' };
const emptyEditForm = { full_name: '', phone: '', role: 'phuc_vu' };

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);

  async function loadStaff() {
    setLoading(true);
    setError('');
    try {
      const res = await staffApi.list();
      setStaffList(res.data.staff);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function openCreateModal() {
    setCreateForm(emptyCreateForm);
    setShowCreateModal(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await staffApi.create(createForm);
      setShowCreateModal(false);
      await loadStaff();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(staff) {
    setEditingStaff(staff);
    setEditForm({ full_name: staff.full_name, phone: staff.phone || '', role: staff.role });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await staffApi.update(editingStaff.id, editForm);
      setEditingStaff(null);
      await loadStaff();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(staff) {
    const nextActive = !staff.is_active;
    const verb = nextActive ? 'mở khóa' : 'khóa';
    if (!confirm(`Bạn chắc chắn muốn ${verb} tài khoản "${staff.full_name}"?`)) return;
    try {
      await staffApi.setActive(staff.id, nextActive);
      setStaffList((prev) => prev.map((s) => (s.id === staff.id ? { ...s, is_active: nextActive } : s)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Quản lý nhân sự</h1>
          <p className="text-sm text-slate-500">Tài khoản phục vụ, thu ngân, bếp và quản lý</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus size={16} />
          Thêm nhân sự
        </button>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : staffList.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Chưa có tài khoản nhân sự nào.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-400">
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{s.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.email}</td>
                  <td className="px-4 py-3 text-slate-500">{s.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-basil-50 px-2.5 py-0.5 text-xs font-medium text-basil-700">
                      {ROLE_LABELS[s.role] || s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.is_active ? 'bg-basil-50 text-basil-700' : 'bg-clay-50 text-clay-600'
                      }`}
                    >
                      {s.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(s)}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-basil-600"
                        aria-label="Sửa"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`rounded-full p-1.5 text-slate-400 hover:bg-slate-100 ${
                          s.is_active ? 'hover:text-clay-500' : 'hover:text-basil-600'
                        }`}
                        aria-label={s.is_active ? 'Khóa' : 'Mở khóa'}
                      >
                        {s.is_active ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <Modal title="Thêm nhân sự" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="field-label">Họ tên</label>
              <input
                required
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Mật khẩu</label>
              <input
                type="password"
                required
                minLength={6}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="field-input"
                placeholder="Ít nhất 6 ký tự"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">SĐT</label>
                <input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Vai trò</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                  className="field-input"
                >
                  <option value="phuc_vu">Phục vụ</option>
                  <option value="thu_ngan">Thu ngân</option>
                  <option value="kitchen">Bếp</option>
                  <option value="manager">Quản lý</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                Huỷ
              </button>
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingStaff && (
        <Modal title={`Sửa: ${editingStaff.full_name}`} onClose={() => setEditingStaff(null)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="field-label">Họ tên</label>
              <input
                required
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                className="field-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">SĐT</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Vai trò</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="field-input"
                >
                  <option value="phuc_vu">Phục vụ</option>
                  <option value="thu_ngan">Thu ngân</option>
                  <option value="kitchen">Bếp</option>
                  <option value="manager">Quản lý</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingStaff(null)} className="btn-secondary">
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