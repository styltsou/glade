import { useState } from "react";
import { ChevronRight, Plus, X, FileCode } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import type { PropertyEntry } from "@/types";

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function ScalarEditor({ entry }: { entry: PropertyEntry }) {
  const setProperty = useStore((s) => s.setProperty);
  const original = asText(entry.value);
  const [text, setText] = useState(original);
  const [error, setError] = useState(false);

  const commit = async () => {
    if (text === original) return;
    try {
      await setProperty(entry.key, { kind: "scalar", value: text });
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
        "h-7 w-full min-w-0 rounded bg-transparent px-2 text-sm outline-none hover:bg-accent/50 focus:bg-accent/50",
        error && "ring-1 ring-destructive",
      )}
    />
  );
}

function ListEditor({ entry }: { entry: PropertyEntry }) {
  const setProperty = useStore((s) => s.setProperty);
  const items = (Array.isArray(entry.value) ? entry.value : []).map(asText);
  const [draft, setDraft] = useState("");

  const save = (next: string[]) => setProperty(entry.key, { kind: "list", value: next }).catch(() => {});

  const add = () => {
    const value = draft.trim().replace(/,$/, "");
    setDraft("");
    if (value && !items.includes(value)) save([...items, value]);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 px-1 py-0.5">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
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
        className="h-6 min-w-16 flex-1 bg-transparent px-1 text-xs outline-none"
      />
    </div>
  );
}

function ReadOnlyValue({ entry }: { entry: PropertyEntry }) {
  const setEditFrontmatterOpen = useStore((s) => s.setEditFrontmatterOpen);
  return (
    <div className="flex min-w-0 items-center gap-2 px-2">
      <code className="truncate text-xs text-muted-foreground" title={entry.raw}>
        {entry.raw.replace(/^[^:]*:\s*/, "").trim() || "(complex value)"}
      </code>
      <button
        onClick={() => setEditFrontmatterOpen(true)}
        className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Edit as text
      </button>
    </div>
  );
}

/** Frontmatter shown above the title; collapsible, edits only the lines it touches. */
export function PropertiesPanel() {
  const properties = useStore((s) => s.activeNote?.properties);
  const collapsed = useStore((s) => s.propertiesCollapsed);
  const toggle = useStore((s) => s.toggleProperties);
  const removeProperty = useStore((s) => s.removeProperty);
  const setAddPropertyOpen = useStore((s) => s.setAddPropertyOpen);
  const setEditFrontmatterOpen = useStore((s) => s.setEditFrontmatterOpen);

  if (!properties || properties.status === "none") return null;

  return (
    <div className="mb-4 rounded-lg border border-border text-sm">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={toggle} className="flex flex-1 items-center gap-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronRight className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")} />
          Properties
          {properties.status === "ok" && <span className="font-normal">({properties.entries.length})</span>}
        </button>
        <button
          onClick={() => setEditFrontmatterOpen(true)}
          title="Edit as text"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <FileCode className="size-3.5" />
        </button>
        {properties.status === "ok" && (
          <button
            onClick={() => setAddPropertyOpen(true)}
            title="Add property"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="border-t border-border px-2 py-1.5">
          {properties.status === "invalid" ? (
            <div>
              <p className="mb-1 text-xs text-destructive">Couldn't parse properties. They are shown as written and left untouched.</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{properties.yaml}</pre>
            </div>
          ) : (
            properties.entries.map((entry) => (
              <div key={entry.key} className="group flex items-start gap-2 py-0.5">
                <span className="w-28 shrink-0 truncate pt-1 text-xs text-muted-foreground" title={entry.key}>
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
                  onClick={() => removeProperty(entry.key)}
                  className="mt-1 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
