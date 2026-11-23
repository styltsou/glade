import { useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
  title: string;
  message: string;
  /** The button that answers yes. */
  confirmLabel: string;
  /** The one that answers no (Escape too). */
  cancelLabel?: string;
}

interface Request extends ConfirmOptions {
  resolve: (yes: boolean) => void;
}

// One at a time, in the order asked; kept outside React so plain functions can ask.
let queue: Request[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Ask a yes-or-no question in the app's own dialog, in place of the system's.
 * Resolves to whether the confirm button was chosen.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...options, resolve }];
    notify();
  });
}

function answer(yes: boolean) {
  const [current, ...rest] = queue;
  if (!current) return;
  queue = rest;
  notify();
  current.resolve(yes);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Shows the questions `confirmDialog` asks. Mounted once, with the app's other dialogs. */
export function ConfirmDialog() {
  const current = useSyncExternalStore(subscribe, () => queue[0] ?? null);
  return (
    <AlertDialog open={current !== null} onOpenChange={(open) => !open && answer(false)}>
      {current && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{current.title}</AlertDialogTitle>
            <AlertDialogDescription>{current.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{current.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Answered here, so closing doesn't also count as a no.
                event.preventDefault();
                answer(true);
              }}
            >
              {current.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
