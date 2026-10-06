// src/components/BillPanel.jsx
//
// Panel hiển thị bill của 1 bàn đang co_khach: danh sách món đã gọi + form
// thêm món mới. Dùng chung cho phuc_vu (Phase 5: gọi món) và sau này thu_ngan
// (Phase 7: xem bill để thanh toán) — tách riêng component để tái dùng, tránh
// phải viết lại logic gọi API ở 2 trang khác nhau.

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import Alert from './Alert';
import { billsApi } from '../api/bills';
import { dishesApi } from '../api/dishes';
import { getErrorMessage } from '../api/client';

const ITEM_STATUS_LABEL = {
  cho_xac_nhan: 'Chờ xác nhận',
  dang_che_bien: 'Đang chế biến',
  san_sang: 'Sẵn sàng',
  da_phuc_vu: 'Đã phục vụ',
};

// canEdit: true nếu người xem được phép thêm/xoá món (phuc_vu). thu_ngan sau
// này truyền canEdit=false để chỉ xem, không sửa.
export default function BillPanel({ tableId, canEdit = true }) {
  const [bill, setBill] = useState(null);
  const [items, setItems] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dishId, setDishId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  async function loadBill() {
    setLoading(true);
    setError('');
    try {
      const res = await billsApi.getByTable(tableId);
      setBill(res.data.bill);
      setItems(res.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadDishes() {
    try {
      const res = await dishesApi.list({ available_only: 'true' });
      setDishes(res.data.dishes || []);
    } catch {
      // Không chặn hiển thị bill nếu danh sách món lỗi — chỉ ẩn form thêm món.
    }
  }

  useEffect(() => {
    loadBill();
    if (canEdit) loadDishes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  async function handleAddItem(e) {
    e.preventDefault();
    if (!dishId || !quantity || quantity <= 0) return;
    setAdding(true);
    setError('');
    try {
      const res = await billsApi.addItem(bill.id, { dish_id: Number(dishId), quantity: Number(quantity), note: note || undefined });
      setItems(res.data.items || []);
      setDishId('');
      setQuantity(1);
      setNote('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveItem(itemId) {
    setRemovingId(itemId);
    setError('');
    try {
      const res = await billsApi.removeItem(bill.id, itemId);
      setItems(res.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  }

  const total = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-slate-400" size={22} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}

      {items.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Chưa gọi món nào.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {item.quantity}× {item.dish_name}
                </p>
                <p className="text-xs text-slate-500">
                  {Number(item.unit_price).toLocaleString('vi-VN')}đ · {ITEM_STATUS_LABEL[item.status] || item.status}
                  {item.note && ` · ${item.note}`}
                </p>
              </div>
              {canEdit && item.status === 'cho_xac_nhan' && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={removingId === item.id}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-clay-500"
                  aria-label="Xoá món"
                >
                  {removingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-medium text-ink">
        <span>Tạm tính</span>
        <span>{total.toLocaleString('vi-VN')}đ</span>
      </div>

      {canEdit && (
        <form onSubmit={handleAddItem} className="space-y-2 border-t border-slate-200 pt-3">
          <div className="flex gap-2">
            <select
              value={dishId}
              onChange={(e) => setDishId(e.target.value)}
              className="field-input flex-1"
              required
            >
              <option value="">Chọn món...</option>
              {dishes.map((dish) => (
                <option key={dish.id} value={dish.id}>
                  {dish.name} — {Number(dish.price).toLocaleString('vi-VN')}đ
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="field-input w-20"
              required
            />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field-input"
            placeholder="Ghi chú (ít cay, không hành...)"
          />
          <button type="submit" disabled={adding} className="btn-primary w-full">
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Thêm món
          </button>
        </form>
      )}
    </div>
  );
}