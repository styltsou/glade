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
  previewColors: string[];
  isActive: boolean;
  onClick: () => void;
}

function ThemeCard({
  id: _id,
  label,
  previewColors,
  isActive,
  onClick,
}: ThemeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col items-center gap-2.5 rounded-lg border-2 p-4
        transition-all duration-150 cursor-pointer
        ${
          isActive
            ? "border-primary bg-accent"
            : "border-border hover:border-primary hover:bg-muted"
        }
      `}
    >
      <div className="flex items-center gap-1.5">
        {previewColors.map((color, i) => (
          <span
            key={i}
            className="h-5 w-5 rounded-full border border-border"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
}

export function AppearanceSection() {
  const theme = useStore((state) => state.theme);
  const mode = useStore((state) => state.mode);
  const setTheme = useStore((state) => state.setTheme);
  const setMode = useStore((state) => state.setMode);

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
              previewColors={t.previewColors}
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
