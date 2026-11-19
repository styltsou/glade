import { useEffect, useRef, useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { usePaneNote } from "./PaneContext";
import { cn } from "@/lib/utils";
import type { PropertyEntry } from "@/types";

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function ScalarEditor({ entry }: { entry: PropertyEntry }) {
  const setProperty = useStore((s) => s.setProperty);
  const notePath = usePaneNote()?.path;
  const original = asText(entry.value);
  const [text, setText] = useState(original);
  const [error, setError] = useState(false);

  const commit = async () => {
    if (text === original) return;
    try {
      await setProperty(entry.key, { kind: "scalar", value: text }, notePath);
      setError(false);
    } catch {
      setError(true);
    }
  };

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setText(original);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded bg-transparent px-2 text-sm outline-none hover:bg-accent/50 focus:bg-accent/50",
        error && "ring-1 ring-destructive",
      )}
    />
  );
}

function ListEditor({ entry }: { entry: PropertyEntry }) {
  const setProperty = useStore((s) => s.setProperty);
  const notePath = usePaneNote()?.path;
  const items = (Array.isArray(entry.value) ? entry.value : []).map(asText);
  const [draft, setDraft] = useState("");

  const save = (next: string[]) => setProperty(entry.key, { kind: "list", value: next }, notePath).catch(() => {});

  const add = () => {
    const value = draft.trim().replace(/,$/, "");
    setDraft("");
    if (value && !items.includes(value)) save([...items, value]);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 px-1 py-0.5">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.07] px-3 py-1 text-sm">
          {item}
          <button
            aria-label={`Remove ${item}`}
            onClick={() => save(items.filter((i) => i !== item))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && items.length) {
            save(items.slice(0, -1));
          }
        }}
        placeholder="Add…"
        className="h-7 min-w-16 flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}

function ReadOnlyValue({ entry }: { entry: PropertyEntry }) {
  return (
    <div className="flex min-w-0 items-center px-2">
      <code className="truncate text-sm text-muted-foreground" title={`${entry.raw}\n\nEdit this in raw markdown.`}>
        {entry.raw.replace(/^[^:]*:\s*/, "").trim() || "(complex value)"}
      </code>
    </div>
  );
}

/** A new property typed in place: name, then value. Enter saves, Escape or leaving it empty cancels. */
function NewPropertyRow({ notePath, onDone }: { notePath?: string; onDone: () => void }) {
  const setProperty = useStore((s) => s.setProperty);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const valueRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    const name = key.trim();
    if (!name) return onDone();
    try {
      await setProperty(name, { kind: "scalar", value }, notePath);
      onDone();
    } catch {
      setError(true);
    }
  };

  const base = "h-8 min-w-0 rounded bg-transparent px-2 text-sm outline-none focus:bg-accent/50";
  return (
    <div
      ref={rowRef}
      className="flex items-start gap-3 py-0.5"
      onBlur={(e) => {
        if (!rowRef.current?.contains(e.relatedTarget as Node) && !key.trim()) onDone();
      }}
    >
      <input
        autoFocus
        value={key}
        placeholder="Name"
        onChange={(e) => {
          setKey(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ":") {
            e.preventDefault();
            if (key.trim()) valueRef.current?.focus();
          } else if (e.key === "Escape") onDone();
        }}
        className={cn(base, "w-32 shrink-0 text-muted-foreground placeholder:text-muted-foreground/50", error && "ring-1 ring-destructive")}
      />
      <input
        ref={valueRef}
        value={value}
        placeholder="Value"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          else if (e.key === "Escape") onDone();
        }}
        className={cn(base, "flex-1 placeholder:text-muted-foreground/50")}
      />
    </div>
  );
}

/** A quiet "Properties" subtitle after the tags. Collapsed by default; edits only the lines it touches. Tags have their own UI, so they are left out. */
export function PropertiesPanel() {
  const paneNote = usePaneNote();
  const properties = paneNote?.properties;
  const open = useStore((s) => s.propertiesOpen);
  const toggle = useStore((s) => s.toggleProperties);
  const removeProperty = useStore((s) => s.removeProperty);
  const addRequested = useStore((s) => s.addPropertyOpen);
  const setAddRequested = useStore((s) => s.setAddPropertyOpen);
  const [adding, setAdding] = useState(false);

  // "Add property" from the command palette opens the section with a fresh row.
  useEffect(() => {
    if (!addRequested) return;
    setAddRequested(false);
    if (!useStore.getState().propertiesOpen) toggle();
    setAdding(true);
  }, [addRequested, setAddRequested, toggle]);

  if (!properties) return null;
  const entries = properties.status === "ok" ? properties.entries.filter((e) => e.key.toLowerCase() !== "tags") : [];

  return (
    <div className="mt-5">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className={cn("size-4 transition-transform duration-[120ms] ease-[var(--ease-ui)]", open && "rotate-90")} />
        Properties
        {entries.length > 0 && <span className="font-normal opacity-60">{entries.length}</span>}
      </button>

      {/* Same grid-rows trick as the sidebar folders, so the note below slides instead of jumping. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[120ms] ease-[var(--ease-ui)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        {...({ inert: open ? undefined : "" } as object)}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-2 pl-1 text-sm">
            {properties.status === "invalid" ? (
              <div>
                <p className="mb-1 text-xs text-destructive">Couldn't parse properties. They are shown as written and left untouched. Fix them in raw markdown.</p>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{properties.yaml}</pre>
              </div>
            ) : (
              <>
                {entries.map((entry) => (
                  <div key={entry.key} className="group flex items-start gap-3 py-0.5">
                    <span className="w-32 shrink-0 truncate px-2 pt-[7px] text-sm text-muted-foreground" title={entry.key}>
                      {entry.key}
                    </span>
                    <div className="min-w-0 flex-1">
                      {!entry.editable ? (
                        <ReadOnlyValue entry={entry} />
                      ) : Array.isArray(entry.value) ? (
                        <ListEditor key={JSON.stringify(entry.value)} entry={entry} />
                      ) : (
                        <ScalarEditor key={asText(entry.value)} entry={entry} />
                      )}
                    </div>
                    <button
                      aria-label={`Remove ${entry.key}`}
                      onClick={() => removeProperty(entry.key, paneNote?.path)}
                      className="mt-1.5 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {adding ? (
                  <NewPropertyRow notePath={paneNote?.path} onDone={() => setAdding(false)} />
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    className="mt-0.5 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="size-4" /> Add property
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
