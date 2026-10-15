// src/components/Modal.jsx
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, widthClass = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-4">
      <div className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col ${widthClass} rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-5 flex shrink-0 items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
