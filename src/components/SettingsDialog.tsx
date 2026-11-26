import { useEffect, useRef, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEGMENT_SLIDE_MS, Segmented } from "@/components/ui/segmented";
import { ThemeSwatch } from "@/components/ThemeSwatch";
import { useStore } from "@/store";
import { themes, type ThemeId, type ThemeMode } from "@/themes";
import type { NoteLabel } from "@/store/slices/settingsSlice";

export const openSettings = () => useStore.getState().setSettingsOpen(true);

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const NOTE_LABELS: { id: NoteLabel; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "filename", label: "File name" },
];

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const resolvedMode = useStore((s) => s.resolvedMode);
  const noteLabel = useStore((s) => s.noteLabel);
  const setNoteLabel = useStore((s) => s.setNoteLabel);

  // Recolouring the whole app takes long enough to swallow the thumb's slide,
  // so the switch shows the pick at once and the mode follows once it lands.
  const [shownMode, setShownMode] = useState(mode);
  const modeTimer = useRef<number>();
  useEffect(() => setShownMode(mode), [mode]);
  useEffect(() => () => window.clearTimeout(modeTimer.current), []);
  const pickMode = (next: ThemeMode) => {
    setShownMode(next);
    window.clearTimeout(modeTimer.current);
    modeTimer.current = window.setTimeout(() => setMode(next), SEGMENT_SLIDE_MS);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[min(30rem,calc(100%-2rem))] max-w-none gap-0 p-0">
        <div className="border-b border-border/50 px-5 py-4">
          <DialogTitle className="text-[15px] font-medium">Settings</DialogTitle>
          <DialogDescription className="sr-only">Appearance and how notes are named across the app.</DialogDescription>
        </div>
        <div className="px-5 pb-5">
          <Section heading="Appearance">
            <Row label="Theme">
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
                <SelectTrigger size="sm" className="w-44" aria-label="Theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <ThemeSwatch theme={t.id} mode={resolvedMode} className="size-3.5" />
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Mode">
              <Segmented
                label="Mode"
                value={shownMode}
                onChange={pickMode}
                options={MODES.map((m) => ({ id: m.id, label: <><m.icon className="size-3.5" />{m.label}</> }))}
              />
            </Row>
          </Section>
          <Section heading="Notes">
            <Row label="Show notes by" hint="Names notes in the sidebar, tabs, breadcrumbs and Home.">
              <Segmented label="Show notes by" value={noteLabel} onChange={setNoteLabel} options={NOTE_LABELS} />
            </Row>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section aria-label={heading}>
      <h3 className="pt-4 pb-1 text-xs font-medium text-muted-foreground">{heading}</h3>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-4 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14px]">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
