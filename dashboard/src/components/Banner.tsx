import { AlertCircle } from 'lucide-react';

export function Banner({ message, type = 'error' }: { message: string, type?: 'error' | 'warning' }) {
  const isError = type === 'error';
  return (
    <div className={`flex items-center gap-12 p-12 mb-24 rounded-controls border ${isError ? 'bg-deny/10 border-deny/30 text-text' : 'bg-ask/10 border-ask/30 text-text'}`}>
      <AlertCircle size={16} className={isError ? 'text-deny' : 'text-ask'} aria-hidden="true" />
      <span className="text-[14px] font-medium">{message}</span>
    </div>
  );
}
