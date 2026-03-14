import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildFolderTree,
  ConflictList,
  DropZone,
  ImportPreview,
  ImportProgressBar,
  useImportLogic,
} from "./import";

export function ImportDialog() {
  const {
    importOpen,
    step,
    isDragging,
    isLoading,
    importSource,
    scanError,
    conflicts,
    brokenLinks,
    conflictResolutions,
    targetVault,
    selectedVaultId,
    newVaultName,
    newVaultError,
    isImporting,
    importProgress,
    vaults,
    setTargetVault,
    setSelectedVaultId,
    setNewVaultName,
    setNewVaultNameError,
    handleClose,
    handlePickSource,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleImport,
    handleConflictsImport,
    handleBack,
    handleResolutionChange,
    handleApplyAll,
  } = useImportLogic();

  const folderTree = useMemo(() => {
    if (!importSource) return [];
    return buildFolderTree(importSource.files);
  }, [importSource]);

  return (
    <Dialog
      open={importOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "pick"
              ? "Import Files"
              : `Import ${importSource?.total_count || 0} notes`}
          </DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? "Select markdown files or a folder to import into your vault."
              : `From: ${importSource?.root_path}`}
          </DialogDescription>
        </DialogHeader>

        {scanError && (
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{scanError}</p>
          </div>
        )}

        {step === "pick" && (
          <DropZone
            isDragging={isDragging}
            isLoading={isLoading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handlePickSource}
          />
        )}

        {step === "preview" && importSource && (
          <div className="space-y-4">
            <ImportPreview
              folderTree={folderTree}
              totalCount={importSource.total_count}
              sourcePath={importSource.root_path}
              targetVault={targetVault}
              selectedVaultId={selectedVaultId}
              vaults={vaults}
              newVaultName={newVaultName}
              newVaultError={newVaultError}
              onTargetVaultChange={setTargetVault}
              onSelectedVaultIdChange={setSelectedVaultId}
              onNewVaultNameChange={(name) => {
                setNewVaultName(name);
                setNewVaultNameError("");
              }}
            />
            {newVaultError && (
              <p className="text-sm text-destructive">{newVaultError}</p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isImporting}
              >
                Back
              </Button>
              {isImporting ? (
                <Button 
                  variant="destructive" 
                  onClick={handleClose}
                >
                  Cancel Import
                </Button>
              ) : (
                <Button onClick={handleImport}>
                  Import
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {step === "conflicts" && (
          <div className="space-y-4">
            <ConflictList
              conflicts={conflicts}
              brokenLinks={brokenLinks}
              conflictResolutions={conflictResolutions}
              onResolutionChange={handleResolutionChange}
            />
            {conflicts.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id="applyAll"
                  className="accent-primary"
                  onChange={handleApplyAll}
                />
                <label htmlFor="applyAll">Apply "Keep Both" to all</label>
              </div>
            )}
            {newVaultError && (
              <p className="text-sm text-destructive">{newVaultError}</p>
            )}
            {isImporting && importProgress && (
              <ImportProgressBar
                current={importProgress.current}
                total={importProgress.total}
                fileName={importProgress.file_name}
              />
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isImporting}
              >
                Back
              </Button>
              {isImporting ? (
                <Button
                  variant="destructive"
                  onClick={handleClose}
                >
                  Cancel Import
                </Button>
              ) : (
                <Button onClick={handleConflictsImport}>
                  Import
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
