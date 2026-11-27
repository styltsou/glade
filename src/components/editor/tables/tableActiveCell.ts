import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TableMap, type Rect } from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const tableDragSource = new PluginKey<DecorationSet>("tableDragSource");

/** Mark active cells and temporarily hide the contents of dragged cells. */
export const TableActiveCell = Extension.create({
  name: "tableActiveCell",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tableDragSource,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, previous) {
            const source: { pos: number; rect: Rect } | null | undefined = transaction.getMeta(tableDragSource);
            if (source === undefined) return transaction.docChanged ? DecorationSet.empty : previous;
            const table = source && transaction.doc.nodeAt(source.pos);
            if (!source || !table) return DecorationSet.empty;
            const map = TableMap.get(table);
            const cells = map.cellsInRect(source.rect).map((offset) => {
              const from = source.pos + 1 + offset;
              return Decoration.node(from, from + table.nodeAt(offset)!.nodeSize, {
                class: "note-table-drag-source",
              });
            });
            return DecorationSet.create(transaction.doc, cells);
          },
        },
        props: {
          decorations: (state) => tableDragSource.getState(state),
        },
      }),
      new Plugin({
        props: {
          decorations(state) {
            const { $head } = state.selection;
            for (let depth = $head.depth; depth > 0; depth--) {
              const node = $head.node(depth);
              const role = node.type.spec.tableRole;
              if (role !== "cell" && role !== "header_cell") continue;
              const from = $head.before(depth);
              return DecorationSet.create(state.doc, [
                Decoration.node(from, from + node.nodeSize, {
                  class: "note-table-active-cell",
                }),
              ]);
            }
            return null;
          },
        },
      }),
    ];
  },
});
