// src/components/Alert.jsx
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Alert({ type = 'error', children }) {
  const isError = type === 'error';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
        isError ? 'bg-clay-50 text-clay-600' : 'bg-basil-50 text-basil-700'
      }`}
    >
      {isError ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
