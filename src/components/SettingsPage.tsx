import { useStore } from "@/store";
import { VaultsSection } from "./SettingsPage/VaultsSection";
import { AppearanceSection } from "./SettingsPage/AppearanceSection";
import { AboutSection } from "./SettingsPage/AboutSection";
import { Settings, FolderCog, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sections = [
  { id: "vaults" as const, label: "Vaults", icon: FolderCog },
  { id: "appearance" as const, label: "Appearance", icon: Settings },
  { id: "about" as const, label: "About", icon: Info },
];

export function SettingsPage() {
  const settingsSection = useStore((state) => state.settingsSection);
  const setSettingsSection = useStore((state) => state.setSettingsSection);
  const closeSettingsPage = useStore((state) => state.closeSettingsPage);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-56 border-r border-border bg-secondary/20 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={closeSettingsPage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setSettingsSection(section.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                settingsSection === section.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {settingsSection === "vaults" && <VaultsSection />}
        {settingsSection === "appearance" && <AppearanceSection />}
        {settingsSection === "about" && <AboutSection />}
      </div>
    </div>
  );
}
