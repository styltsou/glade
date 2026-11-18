import { WorkspaceMenu } from "@/components/WorkspaceMenu";

export function SidebarHeader() {
  return (
    <div className="flex h-11 shrink-0 items-center px-2">
      <WorkspaceMenu folder />
    </div>
  );
}
