import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import type { Vault } from "@/types";
import type {
  ImportSource,
  ImportSourceWithConflicts,
  ImportedFile,
  BrokenLink,
  ConflictAction,
  ImportStep,
  VaultTarget,
} from "./types";

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function useImportLogic() {
  const importOpen = useStore((state) => state.importOpen);
  const importPath = useStore((state) => state.importPath);
  const closeImport = useStore((state) => state.closeImport);
  const vaults = useStore((state) => state.vaults);
  const activeVault = useStore((state) => state.activeVault);
  const createVault = useStore((state) => state.createVault);
  const setActiveVault = useStore((state) => state.setActiveVault);
  const goHome = useStore((state) => state.goHome);

  const [step, setStep] = useState<ImportStep>("pick");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const [conflicts, setConflicts] = useState<ImportedFile[]>([]);
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, ConflictAction>>({});
  const [targetVault, setTargetVault] = useState<VaultTarget>("existing");
  const [selectedVaultId, setSelectedVaultId] = useState<string>("");
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultError, setNewVaultError] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    file_name: string;
  } | null>(null);

  const handleClose = useCallback(() => {
    setStep("pick");
    setImportSource(null);
    setScanError(null);
    setConflicts([]);
    setBrokenLinks([]);
    setConflictResolutions({});
    setIsDragging(false);
    setTargetVault("existing");
    setSelectedVaultId(activeVault?.id || "");
    setNewVaultName("");
    setNewVaultError("");
    setImportProgress(null);
    setIsImporting(false);
    closeImport();
  }, [activeVault, closeImport]);

  const scanPath = useCallback(async (path: string) => {
    setScanError(null);
    setIsLoading(true);
    try {
      const source = await invoke<ImportSource>("scan_import_source", { path });
      setImportSource(source);
      setStep("preview");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setScanError(`Failed to scan path: ${errorMsg}`);
      console.error("Failed to scan path:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (importOpen && importPath && step === "pick") {
      scanPath(importPath);
    }
  }, [importOpen, importPath, step, scanPath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isImporting) {
      listen<{ current: number; total: number; file_name: string }>(
        "import-progress",
        (event) => setImportProgress(event.payload),
      ).then((fn) => { unlisten = fn; });
    }
    return () => { if (unlisten) unlisten(); };
  }, [isImporting]);

  const handlePickSource = useCallback(async () => {
    setIsLoading(true);
    try {
      const selected = await open({
        title: "Select files or folder to import",
        multiple: false,
        directory: true,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (selected) {
        await scanPath(selected);
      }
    } catch (error) {
      console.error("Failed to pick source:", error);
    } finally {
      setIsLoading(false);
    }
  }, [scanPath]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const firstFile = e.dataTransfer.files[0];
    const path = (firstFile as File & { path?: string })?.path;
    if (path) {
      await scanPath(path);
    }
  }, [scanPath]);

  const checkConflicts = useCallback(async (vaultId: string) => {
    if (!importSource) return;
    try {
      let targetVaultId = vaultId;
      if (targetVault === "new") {
        const slug = generateSlug(newVaultName);
        const newVault = await createVault(newVaultName.trim(), slug);
        targetVaultId = newVault.id;
      }
      const result = await invoke<ImportSourceWithConflicts>("check_import_conflicts", {
        sourcePath: importSource.root_path,
        vaultId: targetVaultId,
      });
      setBrokenLinks(result.broken_links || []);
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        const defaults: Record<string, ConflictAction> = {};
        result.conflicts.forEach((c: ImportedFile) => { defaults[c.relative_path] = "keep_both"; });
        setConflictResolutions(defaults);
        setStep("conflicts");
      } else if (result.broken_links?.length) {
        setStep("conflicts");
      } else {
        return targetVaultId;
      }
      return null;
    } catch (error) {
      setNewVaultError(String(error));
      return null;
    }
  }, [importSource, targetVault, newVaultName, createVault]);

  const performImport = useCallback(async (vaultId: string) => {
    if (!importSource) return;
    setIsImporting(true);
    setNewVaultError("");
    try {
      if (vaultId !== activeVault?.id) {
        await setActiveVault(vaultId);
      }
      const resolutions = Object.entries(conflictResolutions).map(([relative_path, action]) => ({
        relative_path,
        action,
      }));
      await invoke("import_files", {
        sourcePath: importSource.root_path,
        vaultId,
        resolutions,
      });
      goHome();
      handleClose();
    } catch (error) {
      setNewVaultError(String(error));
    } finally {
      setIsImporting(false);
    }
  }, [importSource, activeVault, setActiveVault, conflictResolutions, goHome, handleClose]);

  const handleImport = useCallback(async () => {
    if (!importSource) return;
    setIsImporting(true);
    setNewVaultError("");
    try {
      let vaultId = selectedVaultId;
      if (targetVault === "new") {
        if (!newVaultName.trim()) {
          setNewVaultError("Vault name is required");
          setIsImporting(false);
          return;
        }
        const slug = generateSlug(newVaultName);
        if (vaults.some((v: Vault) => v.slug === slug)) {
          setNewVaultError("A vault with this name already exists");
          setIsImporting(false);
          return;
        }
        const newVault = await createVault(newVaultName.trim(), slug);
        vaultId = newVault.id;
      }
      if (vaultId !== activeVault?.id) {
        await setActiveVault(vaultId);
      }
      const resolvedVaultId = await checkConflicts(vaultId);
      if (resolvedVaultId) {
        await performImport(resolvedVaultId);
      }
    } catch (error) {
      setNewVaultError(String(error));
    } finally {
      setIsImporting(false);
    }
  }, [importSource, targetVault, selectedVaultId, newVaultName, vaults, activeVault, createVault, setActiveVault, checkConflicts, performImport]);

  const handleConflictsImport = useCallback(async () => {
    let vaultId = selectedVaultId;
    if (targetVault === "new") {
      if (!newVaultName.trim()) {
        setNewVaultError("Vault name is required");
        return;
      }
      const slug = generateSlug(newVaultName);
      if (vaults.some((v: Vault) => v.slug === slug)) {
        setNewVaultError("A vault with this name already exists");
        return;
      }
      const newVault = await createVault(newVaultName.trim(), slug);
      vaultId = newVault.id;
    }
    await performImport(vaultId);
  }, [selectedVaultId, targetVault, newVaultName, vaults, createVault, performImport]);

  const handleBack = useCallback(() => {
    if (step === "conflicts") {
      setStep("preview");
      setConflicts([]);
      setBrokenLinks([]);
      setConflictResolutions({});
    } else {
      setStep("pick");
    }
  }, [step]);

  const handleResolutionChange = useCallback((path: string, action: ConflictAction) => {
    setConflictResolutions((prev) => ({ ...prev, [path]: action }));
  }, []);

  const handleApplyAll = useCallback(() => {
    const allResolutions: Record<string, ConflictAction> = {};
    conflicts.forEach((c) => { allResolutions[c.relative_path] = "keep_both"; });
    setConflictResolutions(allResolutions);
  }, [conflicts]);

  return {
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
    setNewVaultNameError: (e: string) => setNewVaultError(e),
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
  };
}
