import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  errorMessage?: string | null;
}

export function ModalShell({
  title,
  description,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Save",
  confirmDisabled = false,
  errorMessage,
}: ModalShellProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="px-6 py-5">{children}</div>

        {errorMessage ? (
          <div className="border-t border-slate-200 bg-red-50 px-6 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
