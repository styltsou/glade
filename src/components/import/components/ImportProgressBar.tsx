interface ImportProgressBarProps {
  current: number;
  total: number;
  fileName: string;
}

export function ImportProgressBar({
  current,
  total,
  fileName,
}: ImportProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="truncate">Importing: {fileName}</span>
        <span>
          {current} / {total}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
