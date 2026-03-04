import {
  Github as GitHubLogoIcon,
  Zap as LightningBoltIcon,
  Settings2 as MixerHorizontalIcon,
} from "lucide-react";

export function StatusBar() {
  return (
    <div className="statusbar flex items-center justify-between px-4 h-7 shrink-0 bg-background text-[11px] text-muted-foreground w-full select-none">
      <div className="flex items-center gap-1.5">
        <GitHubLogoIcon className="w-3 h-3" />
        <span>Files changed</span>
      </div>
      <div className="flex items-center gap-1">
        <StatusBarButton>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
        </StatusBarButton>
        <StatusBarButton>
          <LightningBoltIcon className="w-3 h-3" />
        </StatusBarButton>
        <StatusBarButton>
          <MixerHorizontalIcon className="w-3 h-3" />
        </StatusBarButton>
      </div>
    </div>
  );
}

function StatusBarButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
      {children}
    </button>
  );
}
