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
      <DialogContent className="max-w-2xl w-full max-h-[85vh]">
        <form
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (step === "preview" && importSource && importSource.total_count > 0 && !isImporting) {
                handleImport();
              } else if (step === "conflicts" && !isImporting) {
                handleConflictsImport();
              }
            }
          }}
        >
        <div className="overflow-y-auto overflow-x-hidden max-h-[calc(85vh-3rem)] pr-2">
        <DialogHeader>
          <DialogTitle>
            {step === "pick"
              ? "Import Files"
              : `Import ${importSource?.total_count || 0} notes`}
          </DialogTitle>
          {step === "pick" && (
            <DialogDescription>
              Select markdown files or a folder to import into your vault.
            </DialogDescription>
          )}
        </DialogHeader>

        {scanError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{scanError}</p>
          </div>
        )}

        {step === "pick" && (
          <div className="mt-4">
            <DropZone
              isDragging={isDragging}
              isLoading={isLoading}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handlePickSource}
            />
          </div>
        )}

        {step === "preview" && importSource && (
          <div className="mt-4 space-y-4">
            <ImportPreview
              key={importSource.root_path}
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
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isImporting}
              >
                Back
              </Button>
              {isImporting ? (
                <Button 
                  type="button"
                  variant="destructive" 
                  onClick={handleClose}
                >
                  Cancel Import
                </Button>
              ) : (
                <Button type="button" onClick={handleImport} disabled={!importSource || importSource.total_count === 0}>
                  Import
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {step === "conflicts" && (
          <div className="mt-4 space-y-4">
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
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isImporting}
              >
                Back
              </Button>
              {isImporting ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleClose}
                >
                  Cancel Import
                </Button>
              ) : (
                <Button type="button" onClick={handleConflictsImport}>
                  Import
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
