export function StatusBar() {
  return (
    <div className="status-bar" aria-hidden>
      <span>9:41</span>
      <div className="status-bar-icons">
        <svg viewBox="0 0 24 24">
          <path d="M2 16.5C2 16.5 5.5 12 12 12s10 4.5 10 4.5" />
          <path d="M5 13.5C5 13.5 7.5 10 12 10s7 3.5 7 3.5" opacity="0.7" />
          <circle cx="12" cy="17" r="1.5" />
        </svg>
        <svg viewBox="0 0 24 24">
          <rect x="1" y="6" width="4" height="12" rx="1" opacity="0.3" />
          <rect x="7" y="4" width="4" height="14" rx="1" opacity="0.5" />
          <rect x="13" y="2" width="4" height="16" rx="1" opacity="0.7" />
          <rect x="19" y="0" width="4" height="18" rx="1" />
        </svg>
        <svg viewBox="0 0 28 14">
          <rect
            x="0"
            y="1"
            width="24"
            height="12"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            opacity="0.4"
          />
          <rect x="25" y="4.5" width="2" height="5" rx="1" opacity="0.3" />
          <rect x="2" y="3" width="16" height="8" rx="1.5" className="status-battery-fill" />
        </svg>
      </div>
    </div>
  );
}
