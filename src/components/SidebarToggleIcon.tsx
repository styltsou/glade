/** The inner line expands from the left to show the pinned sidebar state. */
export function SidebarToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="size-4 shrink-0"
      data-sidebar-expanded={expanded}
    >
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.5" y="3.5" width="4.5" height="9" rx="0.75" fill="currentColor" className="sidebar-toggle-fill" />
    </svg>
  );
}
