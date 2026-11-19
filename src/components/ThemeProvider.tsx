import { useEffect } from "react";
import { useStore } from "@/store";
import { resolveMode, applyToDOM } from "@/store/slices/themeSlice";
import { effectiveMode, knownTheme } from "@/themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore((state) => state.theme);
  const mode = useStore((state) => state.mode);
  const setResolvedMode = useStore((state) => state.setResolvedMode);

  // A saved theme that no longer exists (e.g. "monochrome") becomes the default.
  useEffect(() => {
    if (knownTheme(theme) !== theme) useStore.getState().setTheme(knownTheme(theme));
  }, [theme]);

  useEffect(() => {
    // Determine the actual light/dark mode based on user preference or system
    const currentResolved = resolveMode(mode);
    setResolvedMode(effectiveMode(knownTheme(theme), currentResolved));
    applyToDOM(theme, currentResolved);
  }, [theme, mode, setResolvedMode]);

  useEffect(() => {
    // Listen for OS color scheme changes if mode is set to "system"
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      // Only react to OS changes if we are currently tracking "system"
      if (useStore.getState().mode === "system") {
        const resolved = resolveMode("system");
        setResolvedMode(effectiveMode(knownTheme(useStore.getState().theme), resolved));
        applyToDOM(useStore.getState().theme, resolved);
      }
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [setResolvedMode]);

  return <>{children}</>;
}
