/**
 * One registry for the app's global shortcuts. The command palette dispatches
 * them and shows their labels, so a shortcut and its hint can never disagree.
 */

/** Ctrl+1..8 jump to that tab; Ctrl+9 jumps to the last one, as in Chrome. */
export const TAB_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export type TabDigit = (typeof TAB_DIGITS)[number];

export type GlobalCommand =
  | "toggle-command-palette"
  | "show-shortcuts"
  | `go-to-tab-${TabDigit}`
  | "new-note"
  | "new-folder"
  | "delete"
  | "open-settings"
  | "open-mode-picker"
  | "toggle-sidebar"
  | "toggle-toc"
  | "toggle-edit-mode"
  | "toggle-raw-mode"
  | "new-tab"
  | "close-tab"
  | "reopen-closed-tab"
  | "split-right"
  | "toggle-home"
  | "open-recent"
  | "open-folder"
  | "open-file";

export interface Shortcut {
  /** Physical key (`KeyN`); preferred for letters so layouts don't matter. */
  code?: string;
  /** Logical key, for punctuation such as `,` or `\`. */
  key?: string;
  shiftKey?: boolean;
  altKey?: boolean;
  /** Cmd on macOS, Ctrl elsewhere. */
  mod?: boolean;
}

export interface Keybinding extends Shortcut {
  command: GlobalCommand;
}

export const KEYBINDINGS: Keybinding[] = [
  { command: "toggle-command-palette", code: "KeyK", mod: true },
  { command: "toggle-command-palette", code: "KeyP", mod: true },
  // Ctrl+Shift+/ is Ctrl+? on a US keyboard.
  { command: "show-shortcuts", code: "Slash", mod: true, shiftKey: true },
  { command: "new-note", code: "KeyN", mod: true },
  { command: "new-folder", code: "KeyN", mod: true, shiftKey: true },
  { command: "delete", code: "KeyD", mod: true },
  { command: "open-settings", key: ",", mod: true },
  { command: "open-settings", code: "Comma", mod: true },
  { command: "open-mode-picker", code: "Comma", mod: true, shiftKey: true },
  // First entry is the one shown in hints.
  { command: "toggle-sidebar", code: "Slash", mod: true },
  { command: "toggle-sidebar", code: "KeyB", mod: true },
  { command: "toggle-toc", code: "KeyL", mod: true, shiftKey: true },
  { command: "toggle-edit-mode", code: "KeyE", mod: true },
  { command: "toggle-raw-mode", code: "KeyR", mod: true, shiftKey: true },
  { command: "new-tab", code: "KeyT", mod: true },
  { command: "close-tab", code: "KeyW", mod: true },
  { command: "reopen-closed-tab", code: "KeyT", mod: true, shiftKey: true },
  ...TAB_DIGITS.map((d): Keybinding => ({ command: `go-to-tab-${d}`, code: `Digit${d}`, mod: true })),
  { command: "split-right", key: "\\", mod: true },
  // WebKitGTK reports Ctrl+\ as a control character, so match the physical key too.
  { command: "split-right", code: "Backslash", mod: true },
  { command: "toggle-home", code: "KeyH", mod: true, shiftKey: true },
  { command: "open-recent", code: "KeyO", mod: true },
  { command: "open-folder", code: "KeyO", mod: true, shiftKey: true },
  { command: "open-file", code: "KeyO", mod: true, altKey: true },
];

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
}

export function matchesShortcut(event: KeyboardEvent, kb: Shortcut): boolean {
  if (kb.code !== undefined) {
    if (event.code !== kb.code) return false;
  } else if (kb.key !== undefined) {
    if (event.key.toLowerCase() !== kb.key.toLowerCase()) return false;
  } else {
    return false;
  }
  if (!!kb.shiftKey !== event.shiftKey) return false;
  if (!!kb.altKey !== event.altKey) return false;
  const mac = isMac();
  const modDown = mac ? event.metaKey : event.ctrlKey;
  const otherDown = mac ? event.ctrlKey : event.metaKey;
  if (!!kb.mod !== modDown || otherDown) return false;
  return true;
}

/** The tab a "go to tab" command targets: its position (1-8), or "last" for Ctrl+9. */
export function tabJumpTarget(command: GlobalCommand): number | "last" | null {
  const m = /^go-to-tab-(\d)$/.exec(command);
  if (!m) return null;
  return m[1] === "9" ? "last" : Number(m[1]);
}

export function bindingFor(command: GlobalCommand): Keybinding | undefined {
  return KEYBINDINGS.find((kb) => kb.command === command);
}

/** Physical key codes for punctuation, so hints show the symbol, not "Comma". */
const CODE_SYMBOLS: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
};

/** Key caps for a shortcut, e.g. ["Ctrl", "Shift", "O"] or ["⌘", "⇧", "O"]. */
export function shortcutKeys(kb: Shortcut): string[] {
  const mac = isMac();
  const keys: string[] = [];
  if (kb.mod) keys.push(mac ? "⌘" : "Ctrl");
  if (kb.altKey) keys.push(mac ? "⌥" : "Alt");
  if (kb.shiftKey) keys.push(mac ? "⇧" : "Shift");
  const main = kb.code ? (CODE_SYMBOLS[kb.code] ?? kb.code.replace(/^Key|^Digit/, "")) : (kb.key ?? "");
  keys.push(main.length === 1 ? main.toUpperCase() : main);
  return keys;
}

/** One-line label, e.g. "Ctrl+Shift+O" or "⌘⇧O". */
export function formatShortcut(kb: Shortcut): string {
  return shortcutKeys(kb).join(isMac() ? "" : "+");
}

export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
  );
}
