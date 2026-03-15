import { useStore } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen, FileText } from "lucide-react";

export function OpenWithDialog() {
  const openWithOpen = useStore((state) => state.openWithOpen);
  const openWithPath = useStore((state) => state.openWithPath);
  const closeOpenWith = useStore((state) => state.closeOpenWith);
  const openImport = useStore((state) => state.openImport);

  const handleImport = () => {
    if (openWithPath) {
      openImport(openWithPath);
    }
    closeOpenWith();
  };

  const handleViewOnly = () => {
    // TODO: Implement view-only mode
    console.log("View only:", openWithPath);
    closeOpenWith();
  };

  return (
    <Dialog open={openWithOpen} onOpenChange={(open) => { if (!open) closeOpenWith(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open with Glade</DialogTitle>
          <DialogDescription className="break-all">
            {openWithPath}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            What would you like to do?
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
              <input
                type="radio"
                name="openWith"
                defaultChecked
                className="accent-primary"
              />
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <span className="font-medium">Import into vault</span>
                <p className="text-xs text-muted-foreground">
                  Copy into Glade and own the copy
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
              <input
                type="radio"
                name="openWith"
                className="accent-primary"
                onClick={handleViewOnly}
              />
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <span className="font-medium">View only</span>
                <p className="text-xs text-muted-foreground">
                  Open as reader without importing
                </p>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeOpenWith}>
            Cancel
          </Button>
          <Button onClick={handleImport}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
