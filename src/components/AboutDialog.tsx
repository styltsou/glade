import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { version } from "../../package.json";

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs gap-0 p-6 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-foreground text-2xl font-bold tracking-tight text-background">
          g.
        </div>
        <DialogTitle className="text-base font-semibold">Glade</DialogTitle>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Version {version}</p>
        <DialogDescription className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          A quiet viewer and editor for the markdown files you already have. Your files stay yours.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
