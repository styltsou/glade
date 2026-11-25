import { useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { KbdGroup } from "@/components/ui/kbd";
import { FIND_SHORTCUTS, KEYBINDINGS, formatShortcut, isMac, shortcutKeys, type GlobalCommand, type Shortcut, type TabDigit } from "@/lib/keybindings";

// Open state lives outside React so the palette and the shortcut can open it.
let isOpen = false;
const listeners = new Set<() => void>();
function setOpen(next: boolean) {
  if (isOpen === next) return;
  isOpen = next;
  listeners.forEach((l) => l());
}
export const openShortcuts = () => setOpen(true);

type ListedCommand = Exclude<GlobalCommand, `go-to-tab-${TabDigit}`>;

/** Every registry command has a row here, so a new shortcut can't go unlisted. */
const LABELS: Record<ListedCommand, string> = {
  "toggle-command-palette": "Command palette",
  "show-shortcuts": "Keyboard shortcuts",
  "open-settings": "Settings",
  "open-mode-picker": "Light, dark or system",
  "new-note": "New note",
  "new-folder": "New folder",
  "rename-file": "Rename file or folder",
  delete: "Delete note or folder",
  "toggle-edit-mode": "Switch between reading and editing",
  "toggle-raw-mode": "Show raw markdown",
  "toggle-toc": "Table of contents",
  "toggle-sidebar": "Show or hide the sidebar",
  "toggle-home": "Go to Home",
  "open-recent": "Open recent",
  "open-folder": "Open folder",
  "open-file": "Open file",
  "new-tab": "New tab",
  "close-tab": "Close tab",
  "reopen-closed-tab": "Reopen closed tab",
  "go-back": "Back",
  "go-forward": "Forward",
  "split-right": "Split right",
};

type Row = { label: string; shortcuts: Shortcut[]; keys?: string[][] };

const GROUPS: { heading: string; rows: (ListedCommand | Row)[] }[] = [
  { heading: "General", rows: ["toggle-command-palette", "show-shortcuts", "open-settings", "open-mode-picker"] },
  { heading: "Notes", rows: ["new-note", "new-folder", "rename-file", "delete", "toggle-edit-mode", "toggle-raw-mode", "toggle-toc"] },
  {
    heading: "Tabs and panes",
    rows: [
      "new-tab",
      "close-tab",
      "reopen-closed-tab",
      // Ctrl+1 to Ctrl+8 are tabs 1 to 8; one row stands for the lot.
      { label: "Go to tab 1 to 8", shortcuts: [], keys: [[isMac() ? "⌘" : "Ctrl", "1…8"]] },
      { label: "Go to the last tab", shortcuts: [{ code: "Digit9", mod: true }] },
      "split-right",
    ],
  },
  { heading: "Navigate", rows: ["go-back", "go-forward", "toggle-sidebar", "toggle-home", "open-recent", "open-folder", "open-file"] },
  {
    heading: "Sidebar file tree",
    rows: [
      { label: "Open in the current tab", shortcuts: [], keys: [["Click"]] },
      { label: "Open in a new tab", shortcuts: [], keys: [[isMac() ? "⌘" : "Ctrl", "Click"], ["Middle-click"]] },
      { label: "Open to the side", shortcuts: [], keys: [[isMac() ? "⌥" : "Alt", "Click"]] },
    ],
  },
  {
    heading: "Editor",
    rows: [
      { label: "Save now", shortcuts: [{ code: "KeyS", mod: true }] },
      { label: "Find in note", shortcuts: [FIND_SHORTCUTS.find] },
      { label: "Find and replace", shortcuts: [FIND_SHORTCUTS.replace] },
    ],
  },
];

function bindingsOf(command: ListedCommand): Shortcut[] {
  // Show each distinct label once: `,` and the Comma key read the same.
  const seen = new Set<string>();
  return KEYBINDINGS.filter((kb) => kb.command === command).filter((kb) => {
    const label = formatShortcut(kb);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export function ShortcutsDialog() {
  const open = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isOpen,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[min(40rem,85vh)] w-[min(34rem,calc(100%-2rem))] max-w-none gap-0 overflow-hidden p-0">
        <div className="border-b border-border/50 px-5 py-4">
          <DialogTitle className="text-[15px] font-medium">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">Every shortcut in Glade, grouped by what it does.</DialogDescription>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-4 [&::-webkit-scrollbar]:hidden" style={{ maxHeight: "calc(min(40rem, 85vh) - 3.5rem)" }}>
          {GROUPS.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <h3 className="pt-4 pb-1.5 text-xs font-medium text-muted-foreground">{group.heading}</h3>
              <ul>
                {group.rows.map((row) => {
                  const label = typeof row === "string" ? LABELS[row] : row.label;
                  const shortcuts = typeof row === "string" ? bindingsOf(row) : row.shortcuts;
                  const fixedKeys = typeof row === "string" ? undefined : row.keys;
                  const keyGroups = fixedKeys ?? shortcuts.map(shortcutKeys);
                  return (
                    <li key={label} className="flex min-h-9 items-center gap-4 py-1 text-[14px]">
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {keyGroups.map((keys, i) => (
                            <span key={i} className="inline-flex items-center gap-2">
                              {i > 0 ? <span className="text-xs text-muted-foreground/70">or</span> : null}
                              <KbdGroup keys={keys} />
                            </span>
                          ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
