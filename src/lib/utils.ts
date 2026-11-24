import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Sidebar sections that fold open and shut (folders, tags, pinned) share one
 * speed and curve, so they all feel alike. They are toggled often, so they are
 * quick, on a strong ease-out that moves at once. Pair with
 * `grid-rows-[1fr] opacity-100` / `grid-rows-[0fr] opacity-0`.
 */
export const SIDEBAR_COLLAPSE = "grid transition-[grid-template-rows,opacity] duration-[80ms] ease-[var(--ease-ui)]";

/** The chevron that turns with a `SIDEBAR_COLLAPSE` section. */
export const SIDEBAR_CHEVRON = "transition-transform duration-[80ms] ease-[var(--ease-ui)]";
