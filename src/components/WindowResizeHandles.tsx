import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type ResizeDirection = Parameters<ReturnType<typeof getCurrentWindow>["startResizeDragging"]>[0];

const EDGES: { direction: ResizeDirection; className: string }[] = [
  { direction: "North", className: "inset-x-3 top-0 h-[5px] cursor-n-resize" },
  { direction: "South", className: "inset-x-3 bottom-0 h-[5px] cursor-s-resize" },
  { direction: "East", className: "inset-y-3 right-0 w-[5px] cursor-e-resize" },
  { direction: "West", className: "inset-y-3 left-0 w-[5px] cursor-w-resize" },
  { direction: "NorthEast", className: "right-0 top-0 size-3 cursor-ne-resize" },
  { direction: "NorthWest", className: "left-0 top-0 size-3 cursor-nw-resize" },
  { direction: "SouthEast", className: "right-0 bottom-0 size-3 cursor-se-resize" },
  { direction: "SouthWest", className: "left-0 bottom-0 size-3 cursor-sw-resize" },
];

/** Frameless webviews need reliable hit areas for the OS's native resize drag. */
export function WindowResizeHandles() {
  const [enabled, setEnabled] = useState(false);
  const windowRef = useRef<ReturnType<typeof getCurrentWindow> | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    windowRef.current = appWindow;
    let disposed = false;
    let request = 0;

    const syncState = async () => {
      const current = ++request;
      try {
        const [maximized, fullscreen, resizable] = await Promise.all([
          appWindow.isMaximized(), appWindow.isFullscreen(), appWindow.isResizable(),
        ]);
        if (disposed || current !== request) return;
        document.documentElement.dataset.maximized = String(maximized);
        document.documentElement.dataset.fullscreen = String(fullscreen);
        setEnabled(resizable && !maximized && !fullscreen);
      } catch (error) {
        if (!disposed && current === request) {
          setEnabled(false);
          console.warn("Could not read window resize state:", error);
        }
      }
    };

    const subscriptions = [
      appWindow.onResized(() => { void syncState(); }),
      appWindow.onFocusChanged(() => { void syncState(); }),
    ].map((subscription) => subscription.catch((error) => {
      console.warn("Could not watch window resize state:", error);
      return () => {};
    }));
    void syncState();

    return () => {
      disposed = true;
      windowRef.current = null;
      subscriptions.forEach((subscription) => {
        void subscription.then((unlisten) => unlisten()).catch((error) => {
          console.warn("Could not remove window resize listener:", error);
        });
      });
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[10000]" data-window-resize-handles>
      {EDGES.map(({ direction, className }) => (
        <div
          key={direction}
          data-resize-direction={direction}
          className={`pointer-events-auto absolute touch-none select-none ${className}`}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            void windowRef.current?.startResizeDragging(direction).catch((error) => {
              console.warn("Could not start window resize:", error);
            });
          }}
        />
      ))}
    </div>
  );
}
