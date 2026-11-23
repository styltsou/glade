import { useState } from "react";
import { ChevronLeft, ChevronRight, Monitor, Moon, Sun } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { applyToDOM, resolveMode } from "@/store/slices/themeSlice";
import { effectiveMode, themes, type ThemeId, type ThemeMode } from "@/themes";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** The first page; the rest follow in their usual order. */
const FEATURED: ThemeId[] = ["glade", "vercel", "linear", "claude", "github", "catppuccin"];
const PER_PAGE = 6;
const ORDERED = [...themes.filter((t) => FEATURED.includes(t.id)), ...themes.filter((t) => !FEATURED.includes(t.id))];
const PAGES = Array.from({ length: Math.ceil(ORDERED.length / PER_PAGE) }, (_, i) => ORDERED.slice(i * PER_PAGE, (i + 1) * PER_PAGE));

/** A small page drawn in a theme's own colours (the data attributes scope them). */
function ThemePreview({ theme, mode }: { theme: ThemeId; mode: "light" | "dark" }) {
  return (
    <span
      data-theme={theme}
      data-mode={effectiveMode(theme, mode)}
      aria-hidden
      className="flex h-24 w-full flex-col justify-between rounded-md border border-border bg-background p-3"
    >
      <span className="flex flex-col gap-1.5">
        <span className="h-2 w-1/2 rounded-full bg-foreground/80" />
        <span className="h-2 w-3/4 rounded-full bg-muted-foreground/40" />
        <span className="h-2 w-2/5 rounded-full bg-muted-foreground/40" />
      </span>
      <span className="h-2 w-1/4 rounded-full bg-primary" />
    </span>
  );
}

/** First run: pick light, dark or system and a theme, then open something. Also reachable from the palette. */
export function Onboarding() {
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);
  const setTheme = useStore((s) => s.setTheme);
  const setMode = useStore((s) => s.setMode);
  const setOnboarded = useStore((s) => s.setOnboarded);
  const pickFolder = useStore((s) => s.pickFolder);
  const resolved = resolveMode(mode);
  // Opens on the page that has the chosen theme.
  const [page, setPage] = useState(() => {
    const current = useStore.getState().theme;
    return Math.max(0, PAGES.findIndex((p) => p.some((t) => t.id === current)));
  });
  const go = (next: number) => setPage(Math.min(Math.max(next, 0), PAGES.length - 1));

  const card = (t: (typeof themes)[number]) => {
    const active = t.id === theme;
    return (
      <button
        key={t.id}
        role="radio"
        aria-checked={active}
        onClick={() => setTheme(t.id)}
        onPointerEnter={() => preview(t.id)}
        onFocus={() => preview(t.id)}
        onBlur={restore}
        className={cn(
          "press flex flex-col gap-2.5 rounded-xl border bg-sidebar p-2.5 text-left transition-colors",
          active ? "border-foreground/50 ring-1 ring-foreground/50" : "border-border/70 hover:border-foreground/25",
        )}
      >
        <ThemePreview theme={t.id} mode={resolved} />
        <span className="truncate px-0.5 text-[13px] font-medium">{t.label}</span>
      </button>
    );
  };

  // Hovering a theme shows it on the whole window; leaving puts the chosen one back.
  const preview = (id: ThemeId) => applyToDOM(id, resolveMode(useStore.getState().mode));
  const restore = () => {
    const st = useStore.getState();
    applyToDOM(st.theme, resolveMode(st.mode));
  };

  return (
    <div className="flex flex-1 justify-center overflow-y-auto px-6 pt-[8vh] pb-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground">Welcome to Glade</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how it looks. You can change this any time from the command palette.
          </p>
        </div>

        <section className="mb-7">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">Appearance</h2>
          <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
            {MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "press flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                    active
                      ? "border-foreground/50 bg-sidebar text-foreground ring-1 ring-foreground/50"
                      : "border-border/70 bg-sidebar text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                  )}
                >
                  <m.icon className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">Theme</h2>
          <div role="radiogroup" aria-label="Theme" onPointerLeave={restore} className="-mx-1 overflow-hidden px-1 py-1">
            {/* Pages slide side by side. Every page is as tall as the tallest, so the screen never changes height. */}
            <div
              className="flex transition-transform duration-300 ease-[var(--ease-ui)]"
              style={{ transform: `translateX(-${page * 100}%)` }}
            >
              {PAGES.map((themesOnPage, i) => (
                <div
                  key={i}
                  aria-hidden={i !== page}
                  {...(i === page ? {} : ({ inert: "" } as object))}
                  className={cn(
                    "grid w-full shrink-0 grid-cols-3 content-start gap-3 transition-opacity duration-300 ease-[var(--ease-ui)]",
                    i === page ? "opacity-100" : "opacity-0",
                  )}
                >
                  {themesOnPage.map(card)}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {PAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Themes, page ${i + 1} of ${PAGES.length}`}
                  aria-current={i === page}
                  className="group flex size-5 items-center justify-center rounded-full"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      i === page ? "bg-foreground" : "bg-muted-foreground/40 group-hover:bg-muted-foreground",
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => go(page - 1)}
                disabled={page === 0}
                aria-label="Previous themes"
                className="press flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => go(page + 1)}
                disabled={page === PAGES.length - 1}
                aria-label="Next themes"
                className="press flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setOnboarded(true);
              void pickFolder();
            }}
          >
            Open a folder
          </Button>
          <Button variant="ghost" onClick={() => setOnboarded(true)}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
