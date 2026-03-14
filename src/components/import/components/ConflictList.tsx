import { FileText } from "lucide-react";
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
          <details className="mt-2">
            <summary className="text-xs cursor-pointer text-amber-700 dark:text-amber-300">
              Show broken links
            </summary>
            <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300 space-y-0.5 max-h-20 overflow-y-auto">
              {brokenLinks.map((link, idx) => (
                <li key={idx}>
                  {link.file_relative_path}: → {link.link_target}
                </li>
              ))}
            </ul>
          </details>
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

          <div className="max-h-48 overflow-y-auto border rounded-lg">
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
