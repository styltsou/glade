import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import CodeMirror from "@uiw/react-codemirror";
import { Check, Code, Copy, Download, X } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";
import { mermaidEditorExtensions } from "@/lib/mermaidCodemirror";
import { MermaidCanvas } from "./MermaidCanvas";

const EASE = [0.23, 1, 0.32, 1] as const;
/** The table of contents drawer's curve. */
const DRAWER_EASE = [0.32, 0.72, 0, 1] as const;
const WIDTH_KEY = "glade.mermaid-code-width";
const MIN_WIDTH = 260;
const DEFAULT_WIDTH = 380;

const control =
  "lightbox-control flex h-8 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring";
const btn = `${control} w-8`;

function readWidth() {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return n >= MIN_WIDTH ? n : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

interface MermaidFullViewProps {
  draft: string;
  onDraftChange: (value: string) => void;
  svg: string | null;
  error: string | null;
  copied: boolean;
  onCopy: () => void;
  onExport: () => void;
  onClose: () => void;
}

/**
 * The diagram fills the pane like the image lightbox: no frame around it, the
 * actions float over it, and the source opens as a resizable glass drawer
 * on top of the canvas instead of taking a column away from it.
 */
export function MermaidFullView({ draft, onDraftChange, svg, error, copied, onCopy, onExport, onClose }: MermaidFullViewProps) {
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();
  const dialog = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [width, setWidth] = useState(readWidth);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
  }, []);

  // Esc closes the drawer when typing in it, otherwise the whole view.
  useEffect(() => {
    if (!isPresent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (codeOpen && drawer.current?.contains(document.activeElement)) {
        setCodeOpen(false);
        dialog.current?.focus({ preventScroll: true });
      } else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isPresent, codeOpen, onClose]);

  const maxWidth = useCallback(() => {
    const w = dialog.current?.clientWidth ?? 1200;
    return Math.max(MIN_WIDTH, w - 220);
  }, []);

  const resize = useRef<{ id: number; x: number; w: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { id: e.pointerId, x: e.clientX, w: width };
    setResizing(true);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r || r.id !== e.pointerId) return;
    setWidth(Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, r.w + e.clientX - r.x))));
  };
  const onResizeUp = (e: React.PointerEvent) => {
    if (resize.current?.id !== e.pointerId) return;
    resize.current = null;
    setResizing(false);
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {}
  };

  const shownWidth = Math.min(width, maxWidth());

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Diagram"
      tabIndex={-1}
      className="pointer-events-auto absolute inset-0 outline-none"
      style={resizing ? { cursor: "col-resize" } : undefined}
      initial="hidden"
      animate="visible"
      exit="closed"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-background"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 }, closed: { opacity: 0, transition: { duration: 0.1, ease: EASE } } }}
        transition={{ duration: 0.12, ease: EASE }}
      />

      <motion.div
        className="absolute inset-0"
        variants={{
          hidden: { opacity: 0, transform: reduceMotion ? "none" : "scale(0.96)" },
          visible: { opacity: 1, transform: reduceMotion ? "none" : "scale(1)", transition: { duration: 0.15, ease: EASE } },
          closed: { opacity: 0, transform: reduceMotion ? "none" : "scale(0.98)", transition: { duration: 0.1, ease: EASE } },
        }}
      >
        <MermaidCanvas svg={svg} empty={draft.trim() ? "Rendering…" : "Empty diagram"} />
      </motion.div>

      <AnimatePresence>
        {codeOpen && (
          <motion.div
            ref={drawer}
            key="code"
            role="region"
            aria-label="Diagram source"
            className="absolute top-3 bottom-3 left-3 rounded-lg border border-border/60 bg-popover/75 text-popover-foreground shadow-[var(--elev-pop)] backdrop-blur-xl backdrop-saturate-150"
            style={{ width: shownWidth }}
            // Opens like the table of contents: it comes out of the pane's edge while
            // fading in, on the same curve and timing; the exit is quicker.
            initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateX(calc(-100% - 24px))" }}
            animate={{ opacity: 1, transform: "translateX(0px)", transition: { duration: reduceMotion ? 0.12 : 0.24, ease: DRAWER_EASE } }}
            exit={{ opacity: 0, transform: reduceMotion ? "none" : "translateX(calc(-100% - 24px))", transition: { duration: reduceMotion ? 0.1 : 0.16, ease: DRAWER_EASE } }}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-[inherit]">
            <div className="flex h-10 shrink-0 items-center justify-between pr-1 pl-3.5">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <Tip label="Hide code" className="z-[110]">
                <button type="button" aria-label="Hide code" className={btn} onClick={() => setCodeOpen(false)}>
                  <X className="size-4" />
                </button>
              </Tip>
            </div>
            <div className="min-h-0 flex-1">
              <CodeMirror
                value={draft}
                height="100%"
                theme="none"
                extensions={mermaidEditorExtensions}
                onChange={onDraftChange}
                placeholder="Type Mermaid syntax…"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false, // ours, in mermaidEditorExtensions
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  highlightSelectionMatches: true,
                  bracketMatching: true,
                  autocompletion: false,
                  searchKeymap: false,
                }}
                className="h-full"
                autoFocus
              />
            </div>
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="error"
                  role="status"
                  className="shrink-0 overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1, transition: { duration: 0.16, ease: EASE } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.1, ease: EASE } }}
                >
                  <div className="mx-2 mb-2 max-h-28 overflow-y-auto rounded-lg bg-destructive/10 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-destructive">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize code drawer"
              className="group absolute inset-y-0 -right-[5.5px] w-[10px] cursor-col-resize touch-none"
              data-active={resizing || undefined}
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              onPointerCancel={onResizeUp}
              onDoubleClick={() => {
                setWidth(DEFAULT_WIDTH);
                try {
                  localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
                } catch {}
              }}
            >
              <span className="absolute inset-y-2 left-1/2 w-[3px] -translate-x-1/2 rounded-full transition-colors group-hover:bg-primary/40 group-data-[active]:bg-primary/60" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        role="group"
        aria-label="Diagram actions"
        className="absolute top-3 right-3 flex items-center gap-0.5 rounded-lg p-1 text-popover-foreground"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 }, closed: { opacity: 0, transition: { duration: 0.08 } } }}
        transition={{ duration: 0.1, ease: EASE }}
      >
        <Tip label={codeOpen ? "Hide code" : "Show code"} className="z-[110]">
          <button
            type="button"
            aria-label={codeOpen ? "Hide code" : "Show code"}
            aria-pressed={codeOpen}
            className={`${btn} aria-pressed:bg-foreground/8 aria-pressed:text-foreground`}
            onClick={() => setCodeOpen((v) => !v)}
          >
            <Code className="size-4" />
          </button>
        </Tip>
        <Tip label="Copy source" className="z-[110]">
          <button type="button" aria-label="Copy source" className={btn} onClick={onCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </Tip>
        <Tip label="Export as PNG" className="z-[110]">
          <button type="button" aria-label="Export as PNG" className={btn} onClick={onExport}>
            <Download className="size-4" />
          </button>
        </Tip>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
        <Tip label="Close (Esc)" className="z-[110]">
          <button type="button" aria-label="Close" className={btn} onClick={onClose}>
            <X className="size-4" />
          </button>
        </Tip>
      </motion.div>
    </motion.div>
  );
}
