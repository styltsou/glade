import { useStore } from "@/store";
import type { Group } from "@/lib/tabs";

/*
 * The window is two layers: the frame (title bar and sidebar, one colour) and
 * the pages sitting on it, each joined to its active tab. The drawing is in
 * styles/surfaces.css; this decides which shapes join.
 */

/**
 * Frame showing around the pages (right, bottom, left when there's no
 * sidebar). The same as the sidebar toggle's and the close button's distance
 * from the window's edges. On the right and bottom it also keeps the window's
 * 5px resize strip off the page and its scrollbar.
 */
export const FRAME_GAP = 6;

/**
 * Frame between split pages: an edge's width less, because two pages' edges
 * face into it and only one into an inset. The eye takes lines and frame as
 * one band, which is then 7px in both places (1+5+1, and 1+6).
 */
export const SPLIT_GAP = FRAME_GAP - 1;

export function useSidebarVisible(): boolean {
  return useStore((s) => s.target?.kind === "folder" && !s.homeOpen && !s.sidebarCollapsed);
}

/**
 * A pane's box within the page area. The pages and the tab groups above them
 * both lay out with this, in boxes of the same width, so they round to the
 * same pixels: working out the position any second way landed 1px off now and then.
 */
export function paneBox(index: number, split: boolean, ratio: number) {
  if (!split) return undefined;
  return { flex: `${index === 0 ? ratio : 1 - ratio} 1 0%`, marginLeft: index === 0 ? undefined : SPLIT_GAP };
}

/**
 * A pane's tabs start flush with its page's left edge, except in the left pane
 * with no sidebar, where they start after the folder name.
 */
export function tabsStartFlush(index: number, sidebarVisible: boolean): boolean {
  return index > 0 || sidebarVisible;
}

/**
 * Data attributes for a page. A first tab that is active and flush is the
 * page's top-left corner, so the page itself is square there.
 */
export function pageCorner(flush: boolean, group?: Group) {
  const first = group?.tabs[0];
  return {
    "data-flush": flush ? "" : undefined,
    "data-first-active": first && first.id === group.activeId ? "" : undefined,
  };
}
