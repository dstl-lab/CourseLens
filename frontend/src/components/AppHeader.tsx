import { useRef, useState } from "react";
import SettingsPanel from "./SettingsPanel";

export default function AppHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="relative flex items-center h-11 px-4 gap-3 bg-th-bg border-b border-th-border flex-shrink-0">
      <span className="text-th-text font-semibold text-sm tracking-tight">CourseLens</span>
      <span className="text-xs text-th-dim hidden sm:inline">
        Review AI-proposed course updates
      </span>

      <div className="relative ml-auto flex-shrink-0">
        <button
          ref={settingsBtnRef}
          onClick={() => setSettingsOpen((open) => !open)}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            settingsOpen
              ? "bg-th-elevated text-th-text"
              : "text-th-faint hover:text-th-text hover:bg-th-elevated"
          }`}
          aria-label="Settings"
          aria-expanded={settingsOpen}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7.5" cy="7.5" r="2" />
            <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.06 1.06M11.04 11.04l1.06 1.06M2.9 12.1l1.06-1.06M11.04 3.96l1.06-1.06" />
          </svg>
        </button>

        {settingsOpen && (
          <SettingsPanel anchorRef={settingsBtnRef} onClose={() => setSettingsOpen(false)} />
        )}
      </div>
    </header>
  );
}
