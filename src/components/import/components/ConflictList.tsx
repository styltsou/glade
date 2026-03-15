import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ImportedFile, BrokenLink, ConflictAction } from "../types";

interface ConflictListProps {
  conflicts: ImportedFile[];
  brokenLinks: BrokenLink[];
  conflictResolutions: Record<string, ConflictAction>;
  onResolutionChange: (path: string, action: ConflictAction) => void;
}

export function ConflictList({
  conflicts,
  brokenLinks,
  conflictResolutions,
  onResolutionChange,
}: ConflictListProps) {
  const [linksOpen, setLinksOpen] = useState(false);

  return (
    <div className="space-y-4">
      {brokenLinks.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong className="block mb-1">
              ⚠ {brokenLinks.length} note(s) contain links to files outside this
              directory
            </strong>
            These links will be broken after import. The linked titles will still
            be visible but won&apos;t be clickable.
          </p>
          <button
            type="button"
            onClick={() => setLinksOpen((o) => !o)}
            className="mt-2 flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300 cursor-pointer select-none"
          >
            <motion.span
              animate={{ rotate: linksOpen ? 180 : 0 }}
              transition={{ duration: 0.1 }}
              style={{ display: "flex" }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
            Show broken links
          </button>
          <AnimatePresence initial={false}>
            {linksOpen && (
              <motion.div
                key="broken-links"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.1, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1 max-h-36 overflow-y-auto">
                  {brokenLinks.map((link, idx) => (
                    <li key={idx}>
                      {link.file_relative_path}: → {link.link_target}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {conflicts.length > 0 && (
        <>
          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{conflicts.length} file(s)</strong> already exist in the
              target vault. Choose how to handle each conflict:
            </p>
          </div>

          <div className="min-w-0 max-h-48 overflow-y-auto border rounded-lg">
            <div className="p-2 space-y-2">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.relative_path}
                  className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">
                    {conflict.relative_path}
                  </span>
                  <select
                    value={
                      conflictResolutions[conflict.relative_path] || "keep_both"
                    }
                    onChange={(e) =>
                      onResolutionChange(
                        conflict.relative_path,
                        e.target.value as ConflictAction,
                      )
                    }
                    className="px-2 py-1 text-xs border rounded bg-background"
                  >
                    <option value="skip">Skip</option>
                    <option value="replace">Replace</option>
                    <option value="keep_both">Keep Both</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
