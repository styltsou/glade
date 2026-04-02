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
  const activeVault = useStore((state) => state.activeVault);

  const targetPath = path !== undefined ? path : currentFolder;
  
  const segments = targetPath ? targetPath.split("/") : [];
  
  return (
    <div className={cn("flex items-center select-none overflow-hidden", className)}>
      <Breadcrumb>
        <BreadcrumbList className="text-[14px]">
          <BreadcrumbItem>
            {segments.length === 0 && !activeItem ? (
              <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[250px]">
                {activeVault?.name || "Vault"}
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink 
                onClick={() => navigateToFolder(null)} 
                className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                title={`Go to ${activeVault?.name || "Vault"}`}
              >
                {activeVault?.name || "Vault"}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          
          {segments.map((folder, i) => {
            const folderPath = segments.slice(0, i + 1).join("/");
            const isLast = i === segments.length - 1;
            const isActive = isLast && !activeItem;

            return (
              <React.Fragment key={folderPath}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isActive ? (
                    <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[150px]">
                      {folder}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => navigateToFolder(folderPath)}
                      className="cursor-pointer truncate max-w-[150px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {folder}
                    </BreadcrumbLink>
                  )}
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
