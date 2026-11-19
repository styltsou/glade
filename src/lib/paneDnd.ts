import type { TabDrop } from "@/lib/tabs";

/**
 * Where a drag at (x, y) would land: a position in a tab bar, or a zone of a
 * pane. Tab bars carry `data-tab-strip="<pane index>"` and their tabs
 * `data-tab-id`; panes carry `data-pane-index`.
 */
export function hitTest(x: number, y: number, paneCount: number): TabDrop | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const strip = (el as HTMLElement).closest?.<HTMLElement>("[data-tab-strip]");
    if (strip) {
      const group = Number(strip.dataset.tabStrip);
      const tabs = [...strip.querySelectorAll<HTMLElement>("[data-tab-id]:not([data-exiting]):not([data-dragging])")];
      const stripRect = strip.getBoundingClientRect();
      let index = tabs.length;
      let edge = tabs.length ? tabs[tabs.length - 1].getBoundingClientRect().right : stripRect.left + 4;
      for (let i = 0; i < tabs.length; i++) {
        const r = tabs[i].getBoundingClientRect();
        if (x < r.left + r.width / 2) {
          index = i;
          edge = r.left;
          break;
        }
      }
      return { kind: "strip", group, index, x: edge - stripRect.left + strip.scrollLeft };
    }
    const paneEl = (el as HTMLElement).closest?.<HTMLElement>("[data-pane-index]");
    if (paneEl) {
      const group = Number(paneEl.dataset.paneIndex);
      if (paneCount >= 2) return { kind: "pane", group, zone: "center" };
      const r = paneEl.getBoundingClientRect();
      const rel = (x - r.left) / r.width;
      return { kind: "pane", group, zone: rel < 0.3 ? "left" : rel > 0.7 ? "right" : "center" };
    }
  }
  return null;
}

export function sameDrop(a: TabDrop | null, b: TabDrop | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind || a.group !== b.group) return false;
  return a.kind === "strip" ? a.index === (b as typeof a).index && a.x === (b as typeof a).x : a.zone === (b as typeof a).zone;
}

/** The floating label that follows the pointer while a tab is dragged. */
type Ghost = { label: string; folder: boolean; x: number; y: number } | null;
let ghost: Ghost = null;
const listeners = new Set<() => void>();
export const dragGhost = {
  get: () => ghost,
  set(next: Ghost) {
    ghost = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
