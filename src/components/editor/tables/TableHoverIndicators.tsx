import "./tableHoverIndicators.css";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { moveTableColumn, moveTableRow, TableMap, type Rect } from "@tiptap/pm/tables";
import { Tip } from "@/components/ui/tooltip";
import { tableDragSource } from "./tableActiveCell";

type Axis = "row" | "column";
type Hovered = {
  wrapper: HTMLElement;
  cell: HTMLTableCellElement;
  table: HTMLTableElement;
};
type Drag = {
  axis: Axis;
  from: number;
  boundary: number;
  pointerId: number;
  table: HTMLTableElement;
  pos: number;
  moved: boolean;
  start: number;
  end: number;
  gripOffset: number;
  preview: HTMLDivElement | null;
  handle: HTMLButtonElement;
  floatingHandle: HTMLDivElement | null;
  layer: HTMLDivElement | null;
};

function clearDragPreview(active: Drag) {
  active.layer?.remove();
}

function showDragPreview(
  active: Drag,
  coordinate: number,
  count: number,
) {
  const tableRect = active.table.getBoundingClientRect();
  const edges = boundaries(active.table, active.axis, count);
  const start =
    edges[active.from] -
    (active.axis === "row" ? tableRect.top : tableRect.left);
  const end =
    edges[active.end] -
    (active.axis === "row" ? tableRect.top : tableRect.left);

  if (!active.preview || !active.floatingHandle) {
    // Keep the moving copy outside the table's scroll container. A transformed
    // full-table clone still expands scrollable overflow even when clip-path
    // hides everything except the dragged row/column.
    active.layer = document.createElement("div");
    active.layer.className = "tiptap-editor note-table-drag-layer";
    active.layer.setAttribute("aria-hidden", "true");
    active.layer.inert = true;
    const sourceStyle = getComputedStyle(active.table);
    for (const property of [
      "--background", "--foreground", "--card", "--muted-foreground",
      "--border", "--primary", "--primary-foreground",
    ]) {
      active.layer.style.setProperty(property, sourceStyle.getPropertyValue(property));
    }
    active.layer.style.fontFamily = sourceStyle.fontFamily;
    document.body.appendChild(active.layer);
    active.preview = document.createElement("div");
    active.preview.className = "note-table-drag-preview";
    const copy = active.table.cloneNode(true) as HTMLTableElement;
    copy.classList.add("note-table-drag-copy");
    // Preserve the source's dimensions and typography outside its ancestors.
    copy.style.fontSize = sourceStyle.fontSize;
    copy.style.lineHeight = sourceStyle.lineHeight;
    copy.style.color = sourceStyle.color;
    const cells = active.table.querySelectorAll("td, th");
    copy.querySelectorAll<HTMLElement>("td, th").forEach((cell, index) => {
      const rect = cells[index].getBoundingClientRect();
      cell.style.width = `${rect.width}px`;
      cell.style.minWidth = `${rect.width}px`;
      cell.style.height = `${rect.height}px`;
    });
    active.preview.appendChild(copy);
    active.layer.appendChild(active.preview);
    active.floatingHandle = document.createElement("div");
    active.floatingHandle.className = `note-table-drag-handle note-table-drag-handle-${active.axis}`;
    active.floatingHandle.setAttribute("aria-hidden", "true");
    const icon = active.handle.querySelector("svg");
    if (icon) active.floatingHandle.appendChild(icon.cloneNode(true));
    active.layer.appendChild(active.floatingHandle);
  }
  const row = active.axis === "row";
  const frame = active.preview;
  frame.style.left = `${tableRect.left + (row ? 0 : start)}px`;
  frame.style.top = `${tableRect.top + (row ? start : 0)}px`;
  frame.style.width = `${row ? tableRect.width : end - start}px`;
  frame.style.height = `${row ? end - start : tableRect.height}px`;
  const copy = frame.firstElementChild as HTMLTableElement;
  copy.style.left = `${row ? 0 : -start}px`;
  copy.style.top = `${row ? -start : 0}px`;
  copy.style.width = `${tableRect.width}px`;
  copy.style.height = `${tableRect.height}px`;
  const distance = coordinate - active.start;
  active.floatingHandle.style.left = `${tableRect.left + (row ? 0.5 : active.gripOffset + distance)}px`;
  active.floatingHandle.style.top = `${tableRect.top + (row ? active.gripOffset + distance : 0.5)}px`;
  active.preview.style.transform =
    active.axis === "row"
      ? `translateY(${distance}px)`
      : `translateX(${distance}px)`;
}

function dragSourceRect(map: TableMap, axis: Axis, from: number, end: number): Rect {
  // A merged cell must move as a whole. Expand the band until every cell it
  // touches is fully inside it, then use those same bounds for the ghost.
  const seen = new Set<number>();
  let previousFrom: number;
  let previousEnd: number;
  do {
    previousFrom = from;
    previousEnd = end;
    for (let i = previousFrom; i < previousEnd; i++) {
      const across = axis === "row" ? map.width : map.height;
      for (let j = 0; j < across; j++) {
        const offset = map.map[axis === "row" ? i * map.width + j : j * map.width + i];
        if (seen.has(offset)) continue;
        seen.add(offset);
        const cell = map.findCell(offset);
        from = Math.min(from, axis === "row" ? cell.top : cell.left);
        end = Math.max(end, axis === "row" ? cell.bottom : cell.right);
      }
    }
  } while (from !== previousFrom || end !== previousEnd);
  return axis === "row"
    ? { left: 0, right: map.width, top: from, bottom: end }
    : { left: from, right: end, top: 0, bottom: map.height };
}

function tableInfo(editor: Editor, cell: HTMLTableCellElement) {
  try {
    const $cell = editor.state.doc.resolve(editor.view.posAtDOM(cell, 0));
    let depth = $cell.depth;
    while (depth > 0 && $cell.node(depth).type.name !== "table") depth--;
    if (!depth) return null;
    const pos = $cell.before(depth);
    const map = TableMap.get($cell.node(depth));
    const cellPos = $cell.before(depth + 2);
    const rect = map.findCell(cellPos - pos - 1);
    return { pos, map, rect };
  } catch {
    return null;
  }
}

function boundaries(table: HTMLTableElement, axis: Axis, count: number) {
  const tableRect = table.getBoundingClientRect();
  if (axis === "row") {
    const rows = Array.from(table.rows);
    return [
      ...rows.map((row) => row.getBoundingClientRect().top),
      tableRect.bottom,
    ];
  }
  // COL elements have no reliable bounding box in WebKit. Read real cells,
  // tracking spans so logical columns still line up in merged tables.
  const edges: Array<number | undefined> = Array(count + 1);
  const occupied: number[] = Array(count).fill(0);
  for (const row of Array.from(table.rows)) {
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      while (occupied[column] > 0) column++;
      const rect = cell.getBoundingClientRect();
      edges[column] = rect.left;
      edges[column + cell.colSpan] = rect.right;
      for (let i = column; i < column + cell.colSpan; i++) {
        occupied[i] = cell.rowSpan || table.rows.length;
      }
      column += cell.colSpan;
    }
    for (let i = 0; i < count; i++) occupied[i] = Math.max(0, occupied[i] - 1);
  }
  edges[0] ??= tableRect.left;
  edges[count] ??= tableRect.right;
  // Only interpolate boundaries hidden inside merged cells in every row.
  for (let i = 1; i < count; i++) {
    if (edges[i] !== undefined) continue;
    let next = i + 1;
    while (edges[next] === undefined) next++;
    edges[i] = edges[i - 1]! + (edges[next]! - edges[i - 1]!) / (next - i + 1);
  }
  return edges as number[];
}

/** Edge marks become drag handles for moving the hovered row or column. */
export function TableHoverIndicators({ editor }: { editor: Editor }) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [drop, setDrop] = useState<{ axis: Axis; coordinate: number } | null>(
    null,
  );
  const [, setLayoutVersion] = useState(0);
  const drag = useRef<Drag | null>(null);
  const cancelDrag = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;
    const onMove = (event: PointerEvent) => {
      if (drag.current) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".note-table-hover-indicator")
      )
        return;
      const cell =
        target instanceof Element
          ? target.closest<HTMLTableCellElement>("td, th")
          : null;
      const table = cell?.closest<HTMLTableElement>("table");
      const wrapper = table?.closest<HTMLElement>(".tableWrapper");
      if (!cell || !table || !wrapper || !dom.contains(wrapper)) {
        setHovered(null);
        return;
      }
      setHovered((current) =>
        current?.cell === cell ? current : { wrapper, cell, table },
      );
    };
    const onLeave = () => {
      if (!drag.current) setHovered(null);
    };
    const onScroll = () => setLayoutVersion((version) => version + 1);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("scroll", onScroll, true);
    return () => {
      cancelDrag.current?.();
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("scroll", onScroll, true);
    };
  }, [editor]);

  if (!hovered || !editor.isEditable) return null;
  const { wrapper, cell, table } = hovered;
  const info = tableInfo(editor, cell);
  if (!info) return null;
  const wrapperRect = wrapper.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const columnCenter = cellRect.left + cellRect.width / 2 - wrapperRect.left;
  const rowCenter = cellRect.top + cellRect.height / 2 - wrapperRect.top;
  const tableLeft = tableRect.left - wrapperRect.left;
  const tableTop = tableRect.top - wrapperRect.top;

  function move(axis: Axis, from: number, to: number, pos: number) {
    if (from === to) return;
    const command = axis === "row" ? moveTableRow : moveTableColumn;
    const tableNode = editor.state.doc.nodeAt(pos);
    if (!tableNode) return;
    const firstCell = TableMap.get(tableNode).map[0];
    if (firstCell === undefined) return;
    // The move helpers resolve merged-cell ranges from the current selection.
    const state = editor.state.apply(
      editor.state.tr.setSelection(
        TextSelection.near(editor.state.doc.resolve(pos + 1 + firstCell + 1)),
      ),
    );
    command({ from, to, pos: pos + 1, select: false })(
      state,
      editor.view.dispatch,
    );
    editor.view.focus();
    setHovered(null);
  }

  function handle(axis: Axis) {
    const index = axis === "row" ? info!.rect.top : info!.rect.left;
    const count = axis === "row" ? info!.map.height : info!.map.width;
    const position =
      axis === "column"
        ? { left: columnCenter, top: tableTop + 0.5 }
        : { left: tableLeft + 0.5, top: rowCenter };
    return (
      <Fragment key={axis}>
        <Tip label={`Drag to move ${axis}; use arrow keys to move`} side="top"><button
          type="button"
          aria-label={`Move ${axis} ${index + 1}`}
          className={`note-table-hover-indicator note-table-hover-indicator-${axis}`}
          style={position}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            cancelDrag.current?.();
            const { pos, map, rect } = info!;
            const source = dragSourceRect(map, axis, index, axis === "row" ? rect.bottom : rect.right);
            event.currentTarget.dataset.dragging = "true";
            drag.current = {
              axis,
              from: axis === "row" ? source.top : source.left,
              boundary: index,
              pointerId: event.pointerId,
              table,
              pos,
              moved: false,
              start: axis === "row" ? event.clientY : event.clientX,
              end: axis === "row" ? source.bottom : source.right,
              gripOffset: axis === "row" ? rowCenter - tableTop : columnCenter - tableLeft,
              preview: null,
              handle: event.currentTarget,
              floatingHandle: null,
              layer: null,
            };

            // Track on the window, like block dragging: the desktop webview
            // must keep receiving movement and release away from the grip.
            const onMove = (event: PointerEvent) => {
              const active = drag.current;
              if (!active || active.pointerId !== event.pointerId) return;
              const coordinate = axis === "row" ? event.clientY : event.clientX;
              if (Math.abs(coordinate - active.start) < 5 && !active.moved)
                return;
              showDragPreview(active, coordinate, count);
              if (!active.moved) {
                active.moved = true;
                editor.view.dispatch(editor.state.tr.setMeta(tableDragSource, { pos, rect: source }));
              }
              const edges = boundaries(active.table, axis, count);
              const distance = coordinate - active.start;
              const edgeOffset = axis === "row" ? 30 : 48;
              let boundary = active.end;
              if (distance > 0) {
                // Wait until the dragged item's trailing edge nearly reaches the
                // next slot before offering a destination past that slot.
                const trailingEdge = edges[active.from] + distance;
                for (let i = active.end + 1; i <= count; i++) {
                  if (trailingEdge >= edges[i - 1] - edgeOffset) boundary = i;
                }
              } else {
                const trailingEdge = edges[active.end] + distance;
                for (let i = active.from - 1; i >= 0; i--) {
                  if (trailingEdge <= edges[i + 1] + edgeOffset) boundary = i;
                }
              }
              active.boundary = boundary;
              if (boundary >= active.from && boundary <= active.end) {
                setDrop(null);
                return;
              }
              const rect = wrapper.getBoundingClientRect();
              setDrop({
                axis,
                coordinate:
                  edges[boundary] - (axis === "row" ? rect.top : rect.left),
              });
            };
            const finish = (commit: boolean) => {
              window.removeEventListener("pointermove", onMove, true);
              window.removeEventListener("pointerup", onUp, true);
              window.removeEventListener("pointercancel", onCancel, true);
              window.removeEventListener("keydown", onKey, true);
              window.removeEventListener("blur", onBlur);
              cancelDrag.current = null;
              const active = drag.current;
              drag.current = null;
              if (!active) return;
              delete active.handle.dataset.dragging;
              clearDragPreview(active);
              if (active.moved && !editor.isDestroyed) {
                editor.view.dispatch(editor.state.tr.setMeta(tableDragSource, null));
              }
              setDrop(null);
              const changed = active.boundary < active.from || active.boundary > active.end;
              if (commit && active.moved && changed) {
                move(
                  axis,
                  index,
                  active.boundary > active.from ? active.boundary - 1 : active.boundary,
                  active.pos,
                );
              }
            };
            const onUp = (event: PointerEvent) => {
              if (event.pointerId === drag.current?.pointerId) finish(true);
            };
            const onCancel = (event: PointerEvent) => {
              if (event.pointerId === drag.current?.pointerId) finish(false);
            };
            const onKey = (event: KeyboardEvent) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              finish(false);
            };
            const onBlur = () => finish(false);
            cancelDrag.current = () => finish(false);
            window.addEventListener("pointermove", onMove, true);
            window.addEventListener("pointerup", onUp, true);
            window.addEventListener("pointercancel", onCancel, true);
            window.addEventListener("keydown", onKey, true);
            window.addEventListener("blur", onBlur);
          }}
          onKeyDown={(event) => {
            const previous = axis === "row" ? "ArrowUp" : "ArrowLeft";
            const next = axis === "row" ? "ArrowDown" : "ArrowRight";
            if (event.key !== previous && event.key !== next) return;
            event.preventDefault();
            move(
              axis,
              index,
              Math.max(
                0,
                Math.min(count - 1, index + (event.key === previous ? -1 : 1)),
              ),
              info!.pos,
            );
          }}
        >
          <svg
            className="note-table-indicator-grip"
            viewBox="0 0 14 12"
            aria-hidden="true"
          >
            <circle cx="3" cy="4" r="1" />
            <circle cx="7" cy="4" r="1" />
            <circle cx="11" cy="4" r="1" />
            <circle cx="3" cy="8" r="1" />
            <circle cx="7" cy="8" r="1" />
            <circle cx="11" cy="8" r="1" />
          </svg>
        </button></Tip>
        <span
          aria-hidden="true"
          className={`note-table-indicator-dash note-table-indicator-dash-${axis}`}
          style={position}
        />
      </Fragment>
    );
  }

  return createPortal(
    <>
      {handle("column")}
      {handle("row")}
      {drop && (
        <span
          aria-hidden="true"
          className={`note-table-drop-indicator note-table-drop-indicator-${drop.axis}`}
          style={
            drop.axis === "row"
              ? {
                  top: drop.coordinate,
                  left: tableLeft,
                  width: tableRect.width,
                }
              : {
                  left: drop.coordinate,
                  top: tableTop,
                  height: tableRect.height,
                }
          }
        />
      )}
    </>,
    wrapper,
  );
}
