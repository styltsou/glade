import { useStore } from "@/store";
import { themes, type ThemeMode } from "@/themes";
import { ThemeCard } from "@/components/SettingsPage/AppearanceSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const modeOptions: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const theme = useStore((state) => state.theme);
  const mode = useStore((state) => state.mode);
  const resolvedMode = useStore((state) => state.resolvedMode);
  const setTheme = useStore((state) => state.setTheme);
  const setMode = useStore((state) => state.setMode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">
            Appearance
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Theme selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((t) => (
                <ThemeCard
                  key={t.id}
                  id={t.id}
                  label={t.label}
                  mode={resolvedMode}
                  isActive={theme === t.id}
                  onClick={() => setTheme(t.id)}
                />
              ))}
            </div>
          </div>

          {/* Mode selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Mode
            </label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`
                    flex-1 px-4 py-2 text-sm font-medium transition-colors
                    ${
                      mode === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Theme Card ─────────────────────────────────────────── */
