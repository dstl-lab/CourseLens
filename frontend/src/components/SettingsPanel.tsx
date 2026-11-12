import { useEffect, useRef } from "react";
import { useCourseStore, type ThemeMode } from "../store/courseStore";

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: "system",
    label: "System",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1" y="2" width="12" height="8" rx="1.5" />
        <line x1="4" y1="12" x2="10" y2="12" />
        <line x1="7" y1="10" x2="7" y2="12" />
      </svg>
    ),
  },
  {
    mode: "light",
    label: "Light",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="7" cy="7" r="2.5" />
        <line x1="7" y1="1" x2="7" y2="2.5" />
        <line x1="7" y1="11.5" x2="7" y2="13" />
        <line x1="1" y1="7" x2="2.5" y2="7" />
        <line x1="11.5" y1="7" x2="13" y2="7" />
        <line x1="2.93" y1="2.93" x2="3.99" y2="3.99" />
        <line x1="10.01" y1="10.01" x2="11.07" y2="11.07" />
        <line x1="2.93" y1="11.07" x2="3.99" y2="10.01" />
        <line x1="10.01" y1="3.99" x2="11.07" y2="2.93" />
      </svg>
    ),
  },
  {
    mode: "dark",
    label: "Dark",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M11.5 8.5A5.5 5.5 0 015.5 2.5a5.5 5.5 0 100 9 5.5 5.5 0 006-3z" />
      </svg>
    ),
  },
];

export default function SettingsPanel({ onClose }: Props) {
  const themeMode = useCourseStore((s) => s.themeMode);
  const setThemeMode = useCourseStore((s) => s.setThemeMode);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we hear clicks before they hit other handlers
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed top-12 right-2 z-[200] w-56 rounded-xl shadow-2xl border border-th-border-s overflow-hidden"
      style={{ backgroundColor: 'var(--c-bg-elevated)', color: 'var(--c-text)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-th-muted">
          Settings
        </span>
        <button
          onClick={onClose}
          className="text-th-faint hover:text-th-text transition-colors leading-none text-base"
          aria-label="Close settings"
        >
          ×
        </button>
      </div>

      {/* Appearance section */}
      <div className="p-4">
        <p className="text-[11px] font-medium text-th-muted mb-2.5">Appearance</p>
        <div className="flex rounded-lg overflow-hidden border border-th-border-s">
          {THEME_OPTIONS.map(({ mode, label, icon }) => {
            const active = themeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={`
                  flex-1 flex flex-col items-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors
                  ${active
                    ? "bg-[#6366F1] text-white"
                    : "text-th-muted hover:text-th-text"
                  }
                  ${mode !== "system" ? "border-l border-th-border-s" : ""}
                `}
                aria-pressed={active}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
