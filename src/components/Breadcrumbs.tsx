import { Home } from "lucide-react";
import { useStore } from "@/store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  path?: string | null;
  activeItem?: string;
  className?: string;
}

export function Breadcrumbs({ path, activeItem, className }: BreadcrumbsProps) {
  const currentFolder = useStore((state) => state.currentFolder);
  const navigateToFolder = useStore((state) => state.navigateToFolder);

  const targetPath = path !== undefined ? path : currentFolder;
  
  const segments = targetPath ? targetPath.split("/") : [];
  
  return (
    <div className={cn("flex items-center select-none overflow-hidden", className)}>
      <Breadcrumb>
        <BreadcrumbList className="text-[14px]">
          <BreadcrumbItem>
            <BreadcrumbLink 
              onClick={() => navigateToFolder(null)} 
              className="cursor-pointer flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Go Home"
            >
              <Home className="h-4 w-4" />
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {segments.map((folder, i) => {
            const folderPath = segments.slice(0, i + 1).join("/");
            return (
              <React.Fragment key={folderPath}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    onClick={() => navigateToFolder(folderPath)}
                    className="cursor-pointer truncate max-w-[150px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {folder}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
          
          {activeItem && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[250px]">
                  {activeItem}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
