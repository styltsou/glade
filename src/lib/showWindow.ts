import { getCurrentWindow } from "@tauri-apps/api/window";

let shown = false;

/** Reveal this window (they are created hidden to avoid a white flash). */
export async function showWindowOnce(): Promise<void> {
  if (shown) return;
  shown = true;
  try {
    await getCurrentWindow().show();
  } catch {
    // Not running inside Tauri, or the window is already visible.
  }
}

// Failsafe: never leave a window hidden if the first screen fails to render.
setTimeout(() => void showWindowOnce(), 4000);
