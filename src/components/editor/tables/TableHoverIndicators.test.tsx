import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TableHoverIndicators } from "./TableHoverIndicators";
import { TableActiveCell } from "./tableActiveCell";
import { NoteTableView } from "./tableView";

let editor: Editor;
let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root?.unmount());
  editor?.destroy();
  host?.remove();
  vi.restoreAllMocks();
});

function pointer(target: EventTarget, type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  act(() => { target.dispatchEvent(event); });
}

async function setup(tableHtml?: string) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  const mount = document.createElement("div");
  host.append(mount);
  const rows = [['A', 'B'], ['C', 'D'], ['E', 'F']];
  editor = new Editor({
    element: mount,
    extensions: [
      StarterKit,
      Table.configure({ resizable: true, View: NoteTableView }),
      TableRow, TableCell, TableHeader, TableActiveCell,
    ],
    content: `<p>Outside</p><table><tbody>${tableHtml ?? rows.map(cells =>
      `<tr>${cells.map(text => `<td><p>${text}</p></td>`).join('')}</tr>`,
    ).join('')}</tbody></table>`,
  });
  const controls = document.createElement("div");
  host.append(controls);
  root = createRoot(controls);
  await act(async () => {
    root.render(<TooltipProvider><TableHoverIndicators editor={editor} /></TooltipProvider>);
  });
  const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
    left, top, width, height, right: left + width, bottom: top + height,
    x: left, y: top, toJSON() {},
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    if (this.tagName === 'TR') return rect(10, 10 + (this as HTMLTableRowElement).rowIndex * 40, 200, 40);
    if (this.tagName === 'TD') {
      const cell = this as HTMLTableCellElement;
      const row = cell.parentElement as HTMLTableRowElement;
      return rect(10 + cell.cellIndex * 100, 10 + row.rowIndex * 40, 100, 40);
    }
    // WebKit may report empty COL boxes; the real cells remain measurable.
    if (this.tagName === 'COL') return rect(0, 0, 0, 0);
    return rect(10, 10, 200, 120);
  });
  // Start with the caret outside the table, as it is when hovering without clicking.
  editor.commands.setTextSelection(1);
  pointer(host.querySelector('td')!, 'pointermove', 60, 30);
}

const rowTexts = () => {
  const table = editor.state.doc.child(1);
  return Array.from({length: table.childCount}, (_, i) => table.child(i).textContent);
};

it.each([
  ['row', 0, 10, 30, 10, 120, ['A', 'B'], ['CD', 'EF', 'AB']],
  ['row', 4, 10, 110, 10, 10, ['E', 'F'], ['EF', 'AB', 'CD']],
  ['column', 0, 60, 10, 190, 10, ['A', 'C', 'E'], ['BA', 'DC', 'FE']],
  ['column', 1, 160, 10, 10, 10, ['B', 'D', 'F'], ['BA', 'DC', 'FE']],
] as const)('moves a %s from cell %s with events outside the grip', async (axis, cellIndex, x, y, endX, endY, source, expected) => {
  await setup();
  const cell = host.querySelectorAll('td')[cellIndex];
  pointer(cell, 'pointermove', x, y);
  const handle = host.querySelector<HTMLButtonElement>(`.note-table-hover-indicator-${axis}`)!;
  // Capture is deliberately unavailable, as can happen in the desktop webview.
  pointer(handle, 'pointerdown', x, y);
  pointer(document.body, 'pointermove', endX, endY);
  expect(document.querySelector('.note-table-drag-preview')).not.toBeNull();
  expect(host.querySelector('.note-table-drag-preview')).toBeNull();
  expect([...host.querySelectorAll('.note-table-drag-source')].map((cell) => cell.textContent)).toEqual(source);
  expect(document.querySelectorAll('.note-table-drag-copy')).toHaveLength(1);
  pointer(document.body, 'pointerup', endX, endY);
  expect(rowTexts()).toEqual(expected);
  expect(host.querySelector('.note-table-drag-copy')).toBeNull();
  expect(host.querySelector('.note-table-drag-source')).toBeNull();
  expect(handle.dataset.dragging).toBeUndefined();
  expect(document.querySelector('.note-table-drag-layer')).toBeNull();
});

it.each(['Escape', 'pointercancel', 'blur', 'unmount'])('cancels and cleans up on %s', async (reason) => {
  await setup();
  const handle = host.querySelector<HTMLButtonElement>('.note-table-hover-indicator-row')!;
  pointer(handle, 'pointerdown', 10, 30);
  pointer(window, 'pointermove', 10, 120);
  expect(document.querySelector('.note-table-drag-preview')).not.toBeNull();
  expect(host.querySelector('.note-table-drag-preview')).toBeNull();
  if (reason === 'Escape') {
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); });
  } else if (reason === 'unmount') {
    act(() => root.unmount());
  } else if (reason === 'blur') {
    act(() => { window.dispatchEvent(new Event('blur')); });
  } else {
    pointer(window, reason, 10, 120);
  }
  pointer(window, 'pointerup', 10, 120);
  expect(rowTexts()).toEqual(['AB', 'CD', 'EF']);
  expect(host.querySelector('.note-table-drag-copy')).toBeNull();
  expect(host.querySelector('.note-table-drop-indicator')).toBeNull();
  expect(host.querySelector('.note-table-drag-source')).toBeNull();
  expect(handle.dataset.dragging).toBeUndefined();
  expect(document.querySelector('.note-table-drag-layer')).toBeNull();
});

it('keeps a press without a drag unchanged', async () => {
  await setup();
  const handle = host.querySelector<HTMLButtonElement>('.note-table-hover-indicator-row')!;
  pointer(handle, 'pointerdown', 10, 30);
  pointer(window, 'pointermove', 10, 32);
  pointer(window, 'pointerup', 10, 32);
  expect(rowTexts()).toEqual(['AB', 'CD', 'EF']);
  expect(host.querySelector('.note-table-drag-copy')).toBeNull();
});

it('keeps the column ghost and grip at the grabbed column when COL boxes are empty', async () => {
  await setup();
  pointer(host.querySelectorAll('td')[1], 'pointermove', 160, 30);
  const handle = host.querySelector<HTMLButtonElement>('.note-table-hover-indicator-column')!;
  pointer(handle, 'pointerdown', 160, 10);
  pointer(window, 'pointermove', 180, 10);
  const ghost = document.querySelector<HTMLElement>('.note-table-drag-preview')!;
  const grip = document.querySelector<HTMLElement>('.note-table-drag-handle')!;
  expect(ghost.style.left).toBe('110px');
  expect(ghost.style.width).toBe('100px');
  expect(ghost.style.height).toBe('120px');
  expect(ghost.style.transform).toBe('translateX(20px)');
  expect(grip.style.left).toBe('180px');
  expect(host.querySelector('.note-table-drag-copy')).toBeNull();
  expect((ghost.firstElementChild as HTMLElement).style.clipPath).toBe('');
  pointer(window, 'pointercancel', 180, 10);
});

it('keeps the full merged cell in the source slot and ghost when a row crosses it', async () => {
  await setup(`
    <tr><td rowspan="2"><p>A</p></td><td><p>B</p></td></tr>
    <tr><td><p>D</p></td></tr>
    <tr><td><p>E</p></td><td><p>F</p></td></tr>
  `);
  const cell = host.querySelector('tr:nth-child(2) td')!;
  pointer(cell, 'pointermove', 160, 70);
  const handle = host.querySelector<HTMLButtonElement>('.note-table-hover-indicator-row')!;
  pointer(handle, 'pointerdown', 10, 70);
  pointer(window, 'pointermove', 10, 130);
  expect([...host.querySelectorAll('.note-table-drag-source')].map((cell) => cell.textContent)).toEqual(['A', 'B', 'D']);
  expect(document.querySelector<HTMLElement>('.note-table-drag-preview')!.style.height).toBe('80px');
  pointer(window, 'pointerup', 10, 130);
  expect(rowTexts()).toEqual(['EF', 'AB', 'D']);
});
