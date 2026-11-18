import { useStore } from "@/store";
import { themes, type ThemeId, type ThemeMode } from "@/themes";

const modeOptions: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

interface ThemeCardProps {
  id: ThemeId;
  label: string;
  mode: "light" | "dark";
  isActive: boolean;
  onClick: () => void;
}

/** A small live render of the theme: the tokens apply to this subtree. */
export function ThemeCard({ id, label, mode, isActive, onClick }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className="group flex flex-col gap-2 text-left outline-none"
    >
      <div
        data-theme={id}
        data-mode={mode}
        className={`flex h-24 w-full overflow-hidden rounded-lg border bg-background transition-shadow duration-100 ${
          isActive ? "border-transparent ring-2 ring-foreground/70" : "border-border group-hover:ring-2 group-hover:ring-foreground/15"
        }`}
        style={{ colorScheme: mode }}
      >
        <div className="flex w-1/3 flex-col gap-1.5 border-r border-sidebar-border bg-sidebar p-2">
          <span className="h-1.5 w-3/4 rounded-full bg-sidebar-foreground/70" />
          <span className="h-3 w-full rounded bg-sidebar-accent" />
          <span className="h-1.5 w-2/3 rounded-full bg-sidebar-foreground/40" />
          <span className="h-1.5 w-1/2 rounded-full bg-sidebar-foreground/40" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <span className="h-2 w-2/3 rounded-full bg-foreground/85" />
          <span className="h-1.5 w-full rounded-full bg-muted-foreground/45" />
          <span className="h-1.5 w-5/6 rounded-full bg-muted-foreground/45" />
          <span className="mt-auto h-3 w-8 rounded bg-primary" />
        </div>
      </div>
      <span className={`text-[13px] ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </button>
  );
}

export function AppearanceSection() {
  const theme = useStore((state) => state.theme);
  const mode = useStore((state) => state.mode);
  const setTheme = useStore((state) => state.setTheme);
  const setMode = useStore((state) => state.setMode);
  const resolvedMode = useStore((state) => state.resolvedMode);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h3 className="text-lg font-semibold">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-muted-foreground">Theme</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <div className="space-y-4">
        <label className="text-sm font-medium text-muted-foreground">Mode</label>
        <div className="flex rounded-lg border border-border overflow-hidden max-w-xs">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`
                flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer
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
  );
}
