import { useEffect } from "react";
import { useStore } from "@/store";
import { resolveMode, applyToDOM } from "@/store/slices/themeSlice";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore((state) => state.theme);
  const mode = useStore((state) => state.mode);
  const setResolvedMode = useStore((state) => state.setResolvedMode);

  useEffect(() => {
    // Determine the actual light/dark mode based on user preference or system
    const currentResolved = resolveMode(mode);
    setResolvedMode(currentResolved);
    applyToDOM(theme, currentResolved);
  }, [theme, mode, setResolvedMode]);

  useEffect(() => {
    // Listen for OS color scheme changes if mode is set to "system"
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      // Only react to OS changes if we are currently tracking "system"
      if (useStore.getState().mode === "system") {
        const resolved = resolveMode("system");
        setResolvedMode(resolved);
        applyToDOM(useStore.getState().theme, resolved);
      }
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [setResolvedMode]);

  return <>{children}</>;
}
