import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown,
  Clock3, Eye, Loader2, MapPin, Minus, Plus, Search, ShieldCheck,
  PanelRightClose, PanelRightOpen, ShoppingBag, Users, Utensils, UtensilsCrossed, X,
} from 'lucide-react';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { dishesApi } from '../api/dishes';
import { reservationsApi } from '../api/reservations';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';
import './ReservationPage.css';

const TABLE_SLOTS = [
  { x: 22, y: 27 }, { x: 36, y: 27 }, { x: 50, y: 27 }, { x: 64, y: 27 }, { x: 78, y: 27 },
  { x: 21, y: 56 }, { x: 39, y: 56 }, { x: 57, y: 56 }, { x: 76, y: 56 },
  { x: 30, y: 80 }, { x: 49, y: 80 }, { x: 69, y: 80 },
];
const RESERVATION_HOURS = Array.from({ length: 15 }, (_, index) => String(index + 7).padStart(2, '0'));
const RESERVATION_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const STATUS_LABEL = {
  trong: 'Trống',
  giu_tam: 'Giữ chỗ',
  da_dat: 'Đã đặt',
  co_khach: 'Đang có khách',
};
const STATUS_CLASS = {
  trong: 'available',
  giu_tam: 'held',
  da_dat: 'booked',
  co_khach: 'occupied',
};

function getLocalDateString(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function countdownText(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function isWithinReservationHours(time) {
  return time >= '07:00' && time <= '21:00';
}

function tableName(table) {
  return table.table_number || `#${table.id}`;
}

function tableIdsKey(tables) {
  return tables.map((table) => String(table.id)).sort().join('|');
}

function getTablePositions(tables) {
  const sorted = [...tables].sort((first, second) =>
    String(tableName(first)).localeCompare(String(tableName(second)), 'vi', { numeric: true })
  );
  const columns = Math.ceil(Math.sqrt(sorted.length * 1.45));
  const rows = Math.ceil(sorted.length / Math.max(columns, 1));
  return new Map(sorted.map((table, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const fallback = sorted.length <= TABLE_SLOTS.length
      ? TABLE_SLOTS[index]
      : {
        x: columns === 1 ? 50 : 18 + (column * 66) / (columns - 1),
        y: rows === 1 ? 52 : 26 + (row * 55) / (rows - 1),
      };
    const rawX = Number(table.position_x ?? table.layout_x ?? table.x);
    const rawY = Number(table.position_y ?? table.layout_y ?? table.y);
    const hasCoordinates = Number.isFinite(rawX) && Number.isFinite(rawY);
    const normalizeCoordinate = (coordinate, minimum, maximum) =>
      Math.min(maximum, Math.max(minimum, coordinate <= 1 ? coordinate * 100 : coordinate));
    return [
      String(table.id),
      hasCoordinates
        ? { x: normalizeCoordinate(rawX, 8, 92), y: normalizeCoordinate(rawY, 12, 88) }
        : fallback,
    ];
  }));
}

function connectedByPosition(tables, positions) {
  if (tables.length < 2) return false;
  const remaining = new Set(tables.slice(1).map((table) => String(table.id)));
  const reached = new Set([String(tables[0].id)]);
  let changed = true;

  while (changed) {
    changed = false;
    tables.forEach((table) => {
      const id = String(table.id);
      if (!reached.has(id)) return;
      [...remaining].forEach((candidateId) => {
        const candidate = tables.find((item) => String(item.id) === candidateId);
        const firstPosition = positions.get(id);
        const secondPosition = positions.get(candidateId);
        if (
          candidate &&
          Math.hypot(firstPosition.x - secondPosition.x, firstPosition.y - secondPosition.y) <= 21
        ) {
          reached.add(candidateId);
          remaining.delete(candidateId);
          changed = true;
        }
      });
    });
  }
  return remaining.size === 0;
}

function findAdjacentGroups(openTables, targetCapacity, positions) {
  const byId = new Map(openTables.map((table) => [String(table.id), table]));
  const neighbors = new Map(openTables.map((table) => [String(table.id), []]));

  openTables.forEach((table, index) => {
    const first = positions.get(String(table.id));
    openTables.slice(index + 1).forEach((other) => {
      const second = positions.get(String(other.id));
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance <= 21) {
        neighbors.get(String(table.id)).push(String(other.id));
        neighbors.get(String(other.id)).push(String(table.id));
      }
    });
  });

  const found = new Map();
  function walk(group, capacity, frontier) {
    if (group.length > 1 && capacity >= targetCapacity) {
      const ids = group.map((table) => String(table.id));
      const key = ids.slice().sort().join('|');
      if (!found.has(key)) found.set(key, { tables: group, total_capacity: capacity, is_combined: true });
      return;
    }
    if (group.length >= 4) return;

    frontier.forEach((id) => {
      if (group.some((table) => String(table.id) === id)) return;
      const nextTable = byId.get(id);
      if (!nextTable) return;
      const nextFrontier = new Set(frontier);
      neighbors.get(id).forEach((neighborId) => nextFrontier.add(neighborId));
      walk([...group, nextTable], capacity + Number(nextTable.capacity), nextFrontier);
    });
  }

  openTables.forEach((table) => {
    walk([table], Number(table.capacity), new Set(neighbors.get(String(table.id))));
  });

  return [...found.values()]
    .sort((first, second) =>
      first.tables.length - second.tables.length ||
      first.total_capacity - second.total_capacity
    )
    .slice(0, 3);
}

function Chair({ angle, radius }) {
  const radians = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * radius;
  const y = 50 + Math.sin(radians) * radius;
  return <span className="floor-chair" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${angle + 90}deg)` }} />;
}

function FloorTable({ table, position, highlighted, selected, dimmed, disabled, onSelect }) {
  const capacity = Math.max(1, Number(table.capacity) || 1);
  const seatCount = Math.min(8, Math.max(2, capacity));
  const shape = 'square';
  const status = STATUS_CLASS[table.status] || 'available';
  const label = STATUS_LABEL[table.status] || table.status || STATUS_LABEL.trong;

  return (
    <button
      type="button"
      disabled={disabled}
      className={`floor-table ${status}${highlighted ? ' is-highlighted' : ''}${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onClick={() => onSelect(table)}
      aria-label={`Bàn ${tableName(table)}, ${capacity} chỗ, ${label}`}
      aria-pressed={selected}
      title={`Bàn ${tableName(table)} · ${capacity} khách · ${label}`}
    >
      {Array.from({ length: seatCount }, (_, index) => (
        <Chair key={index} angle={(360 / seatCount) * index - 90} radius={shape === 'long' ? 48 : 45} />
      ))}
      <span className={`floor-tabletop ${shape}`}>
        <strong>{tableName(table)}</strong>
        <small><Users size={10} /> {capacity} chỗ</small>
      </span>
      <span className="floor-table-status">{label}</span>
    </button>
  );
}

export function RestaurantFloor({
  tables, matches, selectedTables, searched, loading, error, panelVisible, onTogglePanel, onSelect,
  showPanelToggle = true, interactive = false,
}) {
  const positions = useMemo(() => getTablePositions(tables), [tables]);
  const highlightedIds = new Set(matches.flatMap((option) => option.tables.map((table) => String(table.id))));
  const selectedIds = new Set(selectedTables.map((table) => String(table.id)));

  return (
    <section className="reservation-map-card">
      <div className="reservation-map-heading">
        <div className="reservation-map-title">
          <span className="reservation-map-icon"><Eye size={18} /></span>
          <div>
            <h2>Sơ đồ nhà hàng</h2>
            <p>Góc nhìn từ trên xuống · Tầng trệt</p>
          </div>
        </div>
        <div className="reservation-map-heading-actions">
          <span className="reservation-map-live"><i /> Cập nhật trực tiếp</span>
          {showPanelToggle && (
            <button type="button" className="reservation-panel-toggle" onClick={onTogglePanel}>
              {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              {panelVisible ? 'Ẩn tìm bàn' : 'Hiện tìm bàn'}
            </button>
          )}
        </div>
      </div>

      <div className="floor-viewport">
       <div className="floor-scroll">
        <svg className="floor-architecture" viewBox="0 0 1000 680" role="img" aria-label="Mặt bằng nhà hàng">
          <defs>
            <pattern id="floor-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#e8e5da" strokeWidth="1" />
            </pattern>
            <marker id="walk-arrow" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto">
              <path d="M0,0 L0,8 L7,4 z" fill="#a7a18f" />
            </marker>
          </defs>
          <rect x="8" y="8" width="984" height="664" rx="25" fill="#eae7dc" />
          <rect x="22" y="22" width="956" height="636" rx="19" fill="#faf8f1" stroke="#76746a" strokeWidth="9" />
          <rect x="39" y="39" width="922" height="602" rx="12" fill="url(#floor-grid)" stroke="#dedacd" strokeWidth="2" />
          <rect x="132" y="18" width="735" height="13" rx="6" fill="#d6eee9" stroke="#77a89e" strokeWidth="2" />
          {[245, 355, 465, 575, 685, 795].map((x) => <line key={x} x1={x} y1="19" x2={x} y2="30" stroke="#fff" strokeWidth="3" />)}
          <text x="500" y="57" className="floor-zone-label" textAnchor="middle">CỬA SỔ KÍNH · GARDEN VIEW</text>

          <g className="floor-counter">
            <rect x="53" y="104" width="96" height="152" rx="14" />
            <rect x="65" y="117" width="72" height="126" rx="8" />
            <text x="101" y="169" textAnchor="middle">QUẦY</text>
            <text x="101" y="187" textAnchor="middle">THU NGÂN</text>
            <path d="M93 207h16m-8-8v16" />
          </g>

          <g className="floor-restroom">
            <rect x="865" y="83" width="91" height="78" rx="11" />
            <text x="910" y="113" textAnchor="middle">WC</text>
            <text x="910" y="132" textAnchor="middle">NHÀ VỆ SINH</text>
            <path d="M903 145v10" />
          </g>
          <path d="M905 169v52q0 25-26 25h-8v52" className="floor-walkway" markerEnd="url(#walk-arrow)" />
          <text x="895" y="264" className="floor-small-label" transform="rotate(-90 895 264)" textAnchor="middle">LỐI ĐI</text>

          <g className="floor-plant" transform="translate(114 346)">
            <circle r="23" /><path d="M0 7C-20-5-13-17-3-12 0-27 10-19 8-9 22-14 21 0 7 5Z" />
          </g>
          <g className="floor-plant" transform="translate(885 357)">
            <circle r="23" /><path d="M0 7C-20-5-13-17-3-12 0-27 10-19 8-9 22-14 21 0 7 5Z" />
          </g>
          <g className="floor-plant" transform="translate(115 543)">
            <circle r="20" /><path d="M0 6C-17-4-11-15-2-10 1-23 9-17 7-8 19-12 18 0 6 4Z" />
          </g>
          <g className="floor-plant" transform="translate(884 548)">
            <circle r="20" /><path d="M0 6C-17-4-11-15-2-10 1-23 9-17 7-8 19-12 18 0 6 4Z" />
          </g>
          <rect x="59" y="422" width="101" height="38" rx="14" className="floor-lounge" />
          <text x="110" y="480" className="floor-small-label" textAnchor="middle">KHU CHỜ</text>
          <text x="49" y="315" className="floor-zone-label" transform="rotate(-90 49 315)" textAnchor="middle">LỐI ĐI CHÍNH</text>

          <path d="M417 657A83 83 0 0 1 500 574M583 657A83 83 0 0 0 500 574" className="floor-door" />
          <path d="M500 648v-45" className="floor-walkway" markerEnd="url(#walk-arrow)" />
          <text x="500" y="631" className="floor-small-label" textAnchor="middle">LỐI VÀO</text>
          <text x="500" y="670" className="floor-zone-label" textAnchor="middle">ENTRANCE</text>
        </svg>

        {loading ? (
          <div className="floor-state"><Loader2 size={22} className="animate-spin" />Đang tải sơ đồ bàn...</div>
        ) : error ? (
          <div className="floor-state floor-error"><p>{error}</p></div>
        ) : tables.length === 0 ? (
          <div className="floor-state">Nhà hàng chưa có bàn để hiển thị.</div>
        ) : tables.map((table, index) => {
          const position = positions.get(String(table.id));
          if (!position) return null;
          const statusAvailable = table.status === 'trong';
          const highlighted = highlightedIds.has(String(table.id));
          return (
            <FloorTable
              key={table.id}
              table={table}
              position={{ ...position, index }}
              highlighted={highlighted}
              selected={selectedIds.has(String(table.id))}
              dimmed={searched && statusAvailable && !highlighted}
              disabled={!interactive && !statusAvailable}
              onSelect={onSelect}
            />
          );
        })}
       </div>
      </div>

      <div className="reservation-map-legend">
        <span><i className="legend-free" /> Trống</span>
        <span><i className="legend-booked" /> Đã đặt</span>
        <span><i className="legend-occupied" /> Đang có khách</span>
        <span><i className="legend-selected" /> Đang chọn</span>
        <span className="map-tip">Nhấn vào bàn trống để chọn vị trí</span>
      </div>
    </section>
  );
}

export default function ReservationPage({ embedded = false, tables = [], loading = false, tablesError = '' }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    party_size: '',
    reservation_date: '',
    reservation_time: '18:30',
    phone: user?.phone || '',
  });
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [searching, setSearching] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hold, setHold] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [depositQr, setDepositQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dishes, setDishes] = useState([]);
  const [dishSelections, setDishSelections] = useState({});
  const [dishesLoading, setDishesLoading] = useState(true);
  const [dishesError, setDishesError] = useState('');
  const [error, setError] = useState('');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profilePhoneError, setProfilePhoneError] = useState('');
  const [panelVisible, setPanelVisible] = useState(true);
  const [showDishMenu, setShowDishMenu] = useState(false);
  const [showAllDishes, setShowAllDishes] = useState(false);
  const expiryRef = useRef(null);

  useEffect(() => {
    let active = true;
    usersApi.getProfile()
      .then((res) => {
        if (!active) return;
        const phone = res.data.user?.phone || '';
        setProfilePhone(phone);
        setProfilePhoneError('');
        setForm((current) => current.phone === (user?.phone || '')
          ? { ...current, phone }
          : current);
      })
      .catch((err) => {
        if (active) setProfilePhoneError(getErrorMessage(err));
      });
    return () => { active = false; };
  }, [user?.phone]);

  useEffect(() => {
    let active = true;
    dishesApi.list({ available_only: true })
      .then((res) => {
        if (active) setDishes(res.data.dishes || []);
      })
      .catch((err) => {
        if (active) setDishesError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setDishesLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hold) return undefined;
    expiryRef.current = Date.now() + hold.hold_minutes * 60 * 1000;
    const tick = () => setRemainingSeconds(Math.max(0, Math.round((expiryRef.current - Date.now()) / 1000)));
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [hold]);

  useEffect(() => {
    if (!hold) return undefined;
    let active = true;
    setQrLoading(true);
    reservationsApi.getDepositQr(hold.reservation_id)
      .then((res) => { if (active) setDepositQr(res.data); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setQrLoading(false); });
    return () => { active = false; };
  }, [hold]);

  useEffect(() => {
    if (!hold || confirmed || remainingSeconds === 0) return undefined;
    const intervalId = setInterval(async () => {
      try {
        const res = await reservationsApi.getById(hold.reservation_id);
        if (res.data.reservation.status === 'da_dat') setConfirmed(true);
      } catch {
        // Polling errors are transient; the user can still complete the deposit flow.
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [hold, confirmed, remainingSeconds]);

  const selectedDishCount = Object.values(dishSelections).reduce((sum, item) => sum + item.quantity, 0);
  const selectedDishTotal = dishes.reduce((sum, dish) => {
    const selection = dishSelections[dish.id];
    return sum + (selection ? Number(dish.price) * selection.quantity : 0);
  }, 0);
  const visibleDishes = showAllDishes ? dishes : dishes.slice(0, 4);
  const searched = suggestions.length > 0 || Boolean(form.party_size && error && !hold);
  const [reservationHour, reservationMinute] = form.reservation_time.split(':');

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'phone') setProfilePhoneError('');
  }

  function updateReservationTime(hour, minute) {
    updateForm('reservation_time', `${hour}:${hour === '21' ? '00' : minute}`);
    setError('');
  }

  function toggleDish(dishId) {
    setDishSelections((current) => {
      const next = { ...current };
      if (next[dishId]) delete next[dishId];
      else next[dishId] = { quantity: 1, note: '' };
      return next;
    });
  }

  function updateDish(dishId, field, value) {
    setDishSelections((current) => ({
      ...current,
      [dishId]: {
        ...current[dishId],
        [field]: field === 'quantity' ? Math.max(1, Number(value) || 1) : value,
      },
    }));
  }

  function selectOption(option) {
    setSelectedSuggestion(option);
  }

  function selectTable(table) {
    if (table.status !== 'trong') return;
    const partySize = Number(form.party_size);
    if (!partySize) {
      setError('Nhập số khách trước, sau đó chọn bàn phù hợp trên sơ đồ.');
      return;
    }
    setError('');
    if (Number(table.capacity) < partySize) {
      const combo = suggestions.find((option) =>
        option.is_combined && option.tables.some((candidate) => String(candidate.id) === String(table.id))
      );
      if (combo) setSelectedSuggestion(combo);
      else setError(`Bàn ${tableName(table)} chỉ có ${table.capacity} chỗ. Hãy chọn gợi ý ghép bàn ở cột bên phải.`);
      return;
    }
    const option = suggestions.find((suggestion) =>
      !suggestion.is_combined && String(suggestion.tables[0]?.id) === String(table.id)
    );
    if (option) setSelectedSuggestion(option);
    else setError(`Bàn ${tableName(table)} không nằm trong kết quả tìm kiếm hiện tại.`);
  }

  async function handleSearch(event) {
    event.preventDefault();
    setError('');
    setSuggestions([]);
    setSelectedSuggestion(null);
    if (!form.party_size || Number(form.party_size) < 1) {
      setError('Vui lòng nhập số lượng khách hợp lệ.');
      return;
    }
    if (!form.reservation_date || !form.reservation_time) {
      setError('Vui lòng chọn ngày và giờ đặt bàn.');
      return;
    }
    if (!isWithinReservationHours(form.reservation_time)) {
      setError('Nhà hàng chỉ nhận đặt bàn trong khung giờ 07:00–21:00.');
      return;
    }
    if (tablesError) {
      setError(tablesError);
      return;
    }

    setSearching(true);
    try {
      const openTables = tables.filter((table) => table.status === 'trong');
      const partySize = Number(form.party_size);
      const singles = openTables
        .filter((table) => Number(table.capacity) >= partySize)
        .sort((first, second) => Number(first.capacity) - Number(second.capacity))
        .map((table) => ({
          key: `table-${table.id}`,
          tables: [table],
          total_capacity: Number(table.capacity),
          is_combined: false,
        }));

      let options = singles;
      if (!singles.length) {
        const positions = getTablePositions(tables);
        options = findAdjacentGroups(openTables, partySize, positions)
          .map((option) => ({ ...option, key: `combined-${tableIdsKey(option.tables)}` }));

        try {
          const recommendationRes = await reservationsApi.suggestTables(partySize);
          const recommendation = recommendationRes.data;
          if (recommendation?.is_combined && recommendation.tables?.length) {
            const recommendedTables = recommendation.tables
              .map((recommended) => openTables.find((table) => String(table.id) === String(recommended.id)))
              .filter(Boolean);
            const recommendedCapacity = recommendedTables.reduce((sum, table) => sum + Number(table.capacity), 0);
            const allRecommendedTablesAvailable = recommendedTables.length === recommendation.tables.length;
            if (
              allRecommendedTablesAvailable &&
              recommendedCapacity >= partySize &&
              connectedByPosition(recommendedTables, positions)
            ) {
              const option = {
                key: `combined-${tableIdsKey(recommendedTables)}`,
                tables: recommendedTables,
                total_capacity: recommendedCapacity,
                is_combined: true,
              };
              if (!options.some((existing) => existing.key === option.key)) options.unshift(option);
            }
          }
        } catch {
          // The visual neighbor matching remains available if the optional recommendation endpoint fails.
        }
      }

      setSuggestions(options);
      setSelectedSuggestion(options[0] || null);
      if (!options.length) {
        setError(`Không có bàn đơn hoặc nhóm bàn liền kề còn trống đủ ${partySize} chỗ. Vui lòng thử thời gian khác.`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateReservation() {
    if (!isWithinReservationHours(form.reservation_time)) {
      setError('Nhà hàng chỉ nhận đặt bàn trong khung giờ 07:00–21:00.');
      return;
    }
    if (!selectedSuggestion) {
      setError('Vui lòng tìm và chọn bàn trước khi tiếp tục.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Vui lòng nhập số điện thoại để nhà hàng xác nhận đặt bàn.');
      return;
    }
    setError('');
    setHolding(true);
    try {
      const preorderItems = Object.entries(dishSelections).map(([dishId, selection]) => ({
        dish_id: Number(dishId),
        quantity: selection.quantity,
        note: selection.note.trim(),
      }));
      const response = await reservationsApi.createHold({
        party_size: Number(form.party_size),
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        phone: form.phone.trim(),
        table_ids: selectedSuggestion.tables.map((table) => table.id),
        ...(preorderItems.length ? { preorder_items: preorderItems } : {}),
      });
      setHold(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setSuggestions([]);
      setSelectedSuggestion(null);
    } finally {
      setHolding(false);
    }
  }

  function resetReservation() {
    setForm({
      party_size: '',
      reservation_date: '',
      reservation_time: '18:30',
      phone: profilePhone,
    });
    setSuggestions([]);
    setSelectedSuggestion(null);
    setHold(null);
    setRemainingSeconds(null);
    setDepositQr(null);
    setConfirmed(false);
    setDishSelections({});
    setError('');
  }

  const expired = hold && !confirmed && remainingSeconds === 0;
  return (
    <div className={`reservation-page ${embedded ? 'reservation-page-embedded' : ''}`}>
      <header className="reservation-hero">
        <div>
          <p className="reservation-eyebrow">Dành riêng cho khoảnh khắc của bạn</p>
          <h1>Chọn góc riêng của bạn</h1>
          <p className="reservation-hero-copy">Khám phá không gian, chọn chiếc bàn phù hợp và đặt món trước cho buổi gặp gỡ sắp tới.</p>
        </div>
        <Link to="/my-reservations" className="reservation-history-link"><CalendarDays size={15} /> Lịch sử đặt bàn</Link>
      </header>

      <main className={`reservation-layout${!panelVisible ? ' panel-hidden' : ''}`}>
        <RestaurantFloor
          tables={tables}
          matches={suggestions}
          selectedTables={selectedSuggestion?.tables || []}
          searched={searched}
          loading={loading}
          error={tablesError}
          panelVisible={panelVisible}
          onTogglePanel={() => setPanelVisible((visible) => !visible)}
          onSelect={selectTable}
        />

        {panelVisible && (
          <aside className="reservation-panel">
            <div className="reservation-panel-head">
              <div className="reservation-panel-kicker"><span /> ĐẶT CHỖ TRỰC TUYẾN</div>
              <h2>{hold ? 'Đặt bàn của bạn' : 'Tìm bàn phù hợp'}</h2>
              <p>Chọn thời gian và số khách. Chúng tôi sẽ gợi ý vị trí tốt nhất cho bạn.</p>
            </div>

            {!hold ? (
              <>
                <form className="reservation-form" onSubmit={handleSearch}>
                  <label className="reservation-field">
                    <span className="reservation-label">Số lượng khách <small>Số ghế cần tìm</small></span>
                    <span className="reservation-input-wrap">
                      <Users size={16} />
                      <input
                        type="number"
                        min="1"
                        max="30"
                        required
                        value={form.party_size}
                        onChange={(event) => updateForm('party_size', event.target.value)}
                        placeholder="Ví dụ: 4"
                      />
                    </span>
                  </label>
                  <label className="reservation-field">
                    <span className="reservation-label">Ngày đặt bàn</span>
                    <span className="reservation-input-wrap">
                      <CalendarDays size={16} />
                      <input
                        type="date"
                        min={getLocalDateString()}
                        required
                        value={form.reservation_date}
                        onChange={(event) => updateForm('reservation_date', event.target.value)}
                      />
                    </span>
                  </label>
                  <div className="reservation-time-phone">
                    <label className="reservation-field">
                      <span className="reservation-label">Giờ đến</span>
                      <span className="reservation-input-wrap reservation-time-control">
                        <Clock3 size={16} />
                        <span className="reservation-time-selects">
                          <select
                            aria-label="Giờ"
                            value={reservationHour}
                            onChange={(event) => updateReservationTime(event.target.value, reservationMinute)}
                          >
                            {RESERVATION_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                          </select>
                          <span aria-hidden="true">:</span>
                          <select
                            aria-label="Phút"
                            value={reservationMinute}
                            onChange={(event) => updateReservationTime(reservationHour, event.target.value)}
                          >
                            {(reservationHour === '21' ? ['00'] : RESERVATION_MINUTES)
                              .map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                          </select>
                        </span>
                      </span>
                      <small className="text-xs text-slate-500">Giờ phục vụ: 07:00–21:00</small>
                    </label>
                    <label className="reservation-field">
                      <span className="reservation-label">Số điện thoại</span>
                      <span className="reservation-input-wrap">
                        <MapPin size={16} />
                        <input
                          type="tel"
                          required
                          value={form.phone}
                          onChange={(event) => updateForm('phone', event.target.value)}
                          placeholder="09xxxxxxxx"
                        />
                      </span>
                      {profilePhoneError && <small className="text-xs text-clay-600">Không thể tải số điện thoại từ hồ sơ: {profilePhoneError}</small>}
                    </label>
                  </div>
                  <button type="submit" disabled={searching || loading || tables.length === 0} className="reservation-primary">
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    Tìm bàn phù hợp
                  </button>
                </form>

                {error && <div className="reservation-inline-error"><Alert type="error">{error}</Alert></div>}

                <div className="reservation-results" aria-live="polite">
                  {suggestions.length ? (
                    <>
                      <div className="reservation-results-heading">
                        <strong>{suggestions.some((option) => !option.is_combined) ? 'Bàn trống phù hợp' : 'Gợi ý ghép bàn'}</strong>
                        <span>{suggestions.length} lựa chọn</span>
                      </div>
                      {!suggestions.some((option) => !option.is_combined) && (
                        <p className="reservation-combo-note">
                          Không có bàn đơn đủ {form.party_size} chỗ. Các bàn gợi ý nằm gần nhau trên sơ đồ.
                        </p>
                      )}
                      <div className="reservation-option-list">
                        {suggestions.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => selectOption(option)}
                            className={`reservation-option${option.is_combined ? ' combo' : ''}${selectedSuggestion?.key === option.key ? ' active' : ''}`}
                            aria-pressed={selectedSuggestion?.key === option.key}
                          >
                            <span className="reservation-option-icon"><Users size={15} /></span>
                            <span className="reservation-option-info">
                              <strong>{option.is_combined
                                ? option.tables.map(tableName).join(' + ')
                                : `Bàn ${tableName(option.tables[0])}`}
                              </strong>
                              <small>{option.is_combined ? 'Ghép bàn liền kề' : 'Bàn trống · Chọn vị trí'}</small>
                            </span>
                            <span className="reservation-option-capacity">{option.total_capacity} chỗ</span>
                          </button>
                        ))}
                      </div>
                      <div className="reservation-selected-summary">
                        <Check size={14} />
                        Đang chọn {selectedSuggestion?.tables.map(tableName).join(' + ') || 'chưa chọn bàn'}
                      </div>
                    </>
                  ) : (
                    <div className="reservation-results-empty">
                      <MapPin size={20} />
                      {searched && error
                        ? `Chưa tìm được bàn phù hợp cho ${form.party_size} khách.`
                        : 'Nhập thông tin và tìm bàn để xem các vị trí còn trống.'}
                    </div>
                  )}
                </div>

                <section className="preorder-section">
                  <button type="button" className="preorder-toggle" onClick={() => setShowDishMenu((visible) => !visible)} aria-expanded={showDishMenu}>
                    <span className="preorder-toggle-icon"><UtensilsCrossed size={16} /></span>
                    <span className="preorder-toggle-copy"><strong>Đặt món trước</strong><small>Tùy chọn · Nhà hàng sẽ gọi xác nhận</small></span>
                    {selectedDishCount > 0 && <span className="preorder-count">{selectedDishCount}</span>}
                    <ChevronDown size={16} className={`preorder-chevron${showDishMenu ? ' open' : ''}`} />
                  </button>

                  {showDishMenu && (
                    <div className="preorder-menu">
                      <p className="preorder-disclaimer">Món đặt trước chưa được tính vào bill hoặc gửi xuống bếp. Thu ngân sẽ gọi bạn xác nhận.</p>
                      {dishesLoading ? (
                        <div className="preorder-loading"><Loader2 size={17} className="animate-spin" />Đang tải thực đơn...</div>
                      ) : dishesError ? (
                        <Alert type="error">{dishesError}</Alert>
                      ) : dishes.length === 0 ? (
                        <p className="preorder-empty">Chưa có món ăn khả dụng.</p>
                      ) : (
                        <>
                          <div className="preorder-dish-list">
                            {visibleDishes.map((dish) => {
                              const selection = dishSelections[dish.id];
                              return (
                                <article key={dish.id} className={`preorder-dish${selection ? ' selected' : ''}`}>
                                  <button type="button" className="preorder-dish-main" onClick={() => toggleDish(dish.id)} aria-pressed={Boolean(selection)}>
                                    {dish.image_url ? (
                                      <img className="preorder-dish-image" src={dish.image_url} alt="" />
                                    ) : (
                                      <span className="preorder-dish-placeholder"><Utensils size={17} /></span>
                                    )}
                                    <span className="preorder-dish-info">
                                      <strong>{dish.name}</strong>
                                      {dish.description && <small>{dish.description}</small>}
                                      <b>{Number(dish.price).toLocaleString('vi-VN')}đ</b>
                                    </span>
                                    <span className={`preorder-check${selection ? ' checked' : ''}`}>{selection && <Check size={13} />}</span>
                                  </button>
                                  {selection && (
                                    <div className="preorder-customize">
                                      <div className="preorder-quantity">
                                        <button type="button" onClick={() => updateDish(dish.id, 'quantity', selection.quantity - 1)} disabled={selection.quantity <= 1} aria-label={`Giảm số lượng ${dish.name}`}><Minus size={12} /></button>
                                        <span>{selection.quantity}</span>
                                        <button type="button" onClick={() => updateDish(dish.id, 'quantity', selection.quantity + 1)} aria-label={`Tăng số lượng ${dish.name}`}><Plus size={12} /></button>
                                      </div>
                                      <input
                                        type="text"
                                        value={selection.note}
                                        onChange={(event) => updateDish(dish.id, 'note', event.target.value)}
                                        placeholder="Ghi chú món"
                                        aria-label={`Ghi chú cho ${dish.name}`}
                                      />
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                          {dishes.length > 4 && (
                            <button type="button" className="preorder-show-more" onClick={() => setShowAllDishes((visible) => !visible)}>
                              {showAllDishes ? 'Thu gọn thực đơn' : `Xem tất cả ${dishes.length} món`}
                            </button>
                          )}
                          {selectedDishCount > 0 && (
                            <div className="preorder-total">
                              <span><ShoppingBag size={14} /> {selectedDishCount} món đã chọn</span>
                              <strong>{selectedDishTotal.toLocaleString('vi-VN')}đ</strong>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </section>

                <button
                  type="button"
                  disabled={!selectedSuggestion || holding}
                  onClick={handleCreateReservation}
                  className="reservation-confirm-button"
                >
                  {holding ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {holding ? 'Đang giữ bàn...' : 'Tiếp tục đặt bàn'}
                  <ArrowRight size={15} />
                </button>
                <p className="reservation-trust"><ShieldCheck size={14} /> Món đặt trước chỉ gửi bếp sau khi bạn xác nhận với thu ngân.</p>
              </>
            ) : (
              <div className="reservation-hold-content">
                {error && <div className="reservation-inline-error"><Alert type="error">{error}</Alert></div>}
                {expired ? (
                  <div className="reservation-hold-status">
                    <span className="hold-status-icon expired"><X size={22} /></span>
                    <h3>Đã hết thời gian giữ bàn</h3>
                    <p>Bàn đã được trả về trạng thái trống. Bạn có thể tìm và đặt bàn lại.</p>
                    <button type="button" onClick={resetReservation} className="reservation-primary">Đặt bàn lại</button>
                  </div>
                ) : confirmed ? (
                  <div className="reservation-hold-status">
                    <span className="hold-status-icon"><CheckCircle2 size={23} /></span>
                    <h3>Đặt bàn thành công!</h3>
                    <p>Cọc đã được xác nhận. Nhà hàng sẽ liên hệ về món đặt trước nếu bạn đã chọn món.</p>
                    <Link to="/my-reservations" className="reservation-primary"><CalendarDays size={15} /> Xem đặt bàn của tôi</Link>
                    <button type="button" onClick={resetReservation} className="reservation-reset-link">Đặt bàn khác</button>
                  </div>
                ) : (
                  <>
                    <div className="reservation-hold-summary">
                      <span>MÃ ĐẶT BÀN <strong>#{hold.reservation_id}</strong></span>
                      <span>{form.reservation_date} · {form.reservation_time}</span>
                      <span>Bàn {selectedSuggestion?.tables.map(tableName).join(' + ')} · {form.party_size} khách</span>
                    </div>
                    <div className="reservation-deposit-card">
                      <h3>Quét mã để thanh toán cọc</h3>
                      {qrLoading ? (
                        <div className="reservation-qr-loading"><Loader2 size={22} className="animate-spin" />Đang tải mã thanh toán...</div>
                      ) : depositQr?.qr_url ? (
                        <img src={depositQr.qr_url} alt="Mã QR thanh toán tiền cọc" />
                      ) : (
                        <p className="reservation-qr-error">Chưa lấy được mã QR. Vui lòng tải lại hoặc liên hệ nhà hàng.</p>
                      )}
                      {depositQr?.amount != null && <p className="reservation-deposit-amount">{Number(depositQr.amount).toLocaleString('vi-VN')}đ</p>}
                      {depositQr?.transaction_code && <p className="reservation-transfer-code">Nội dung: <strong>{depositQr.transaction_code}</strong></p>}
                    </div>
                    <div className="reservation-countdown"><Clock3 size={16} /> Thời gian giữ bàn <strong>{remainingSeconds !== null ? countdownText(remainingSeconds) : '--:--'}</strong></div>
                    <p className="reservation-deposit-note">Sau khi chuyển khoản, hệ thống sẽ tự cập nhật khi thu ngân xác nhận.</p>
                  </>
                )}
              </div>
            )}

            <div className="reservation-panel-foot"><ShieldCheck size={15} /> Thông tin của bạn được sử dụng để xác nhận đặt chỗ.</div>
          </aside>
        )}
      </main>
    </div>
  );
}
