import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { Editor } from "@tiptap/react";
import { addImageFiles, isImagePath } from "@/lib/insertImage";

/**
 * Image files dropped from the file manager onto a note. The native drop event
 * (which the webview uses instead of HTML drops) gives paths and a position,
 * so find the editor under the pointer and insert there.
 */
export function useImageDrop(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      const files = event.payload.paths.filter(isImagePath);
      if (files.length === 0) return;
      const ratio = window.devicePixelRatio || 1;
      const x = event.payload.position.x / ratio;
      const y = event.payload.position.y / ratio;
      const dom = document.elementFromPoint(x, y)?.closest(".ProseMirror") as (HTMLElement & { editor?: Editor }) | null;
      const editor = dom?.editor;
      const notePath = (editor?.storage as any)?.paneNote?.path as string | undefined;
      if (!editor || !notePath || !editor.isEditable) return;
      const pos = editor.view.posAtCoords({ left: x, top: y })?.pos;
      void addImageFiles(editor, notePath, files, pos);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [enabled]);
}
