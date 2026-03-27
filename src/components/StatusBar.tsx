import { useState, useEffect, useRef } from "react";
import {
  Github as GitHubLogoIcon,
  Zap as LightningBoltIcon,
  Settings2 as MixerHorizontalIcon,
  Volume2 as VolumeIcon,
  VolumeX as VolumeMuteIcon,
} from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { SOUNDS, type SoundId } from "@/lib/sounds";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { soundEngine as SoundEngineType } from "@/lib/soundEngine";

export function StatusBar() {
  const openSettingsPage = useStore((state) => state.openSettingsPage);
  const soundStates = useStore((state) => state.soundStates);
  const setSoundStates = useStore((state) => state.setSoundStates);
  const isSidebarLoaded = useStore((state) => state.isSidebarLoaded);
  
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [, setInitialized] = useState(false);
  
  const engineRef = useRef<typeof SoundEngineType | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSidebarLoaded) return;
    
    (async () => {
      try {
        const module = await import("@/lib/soundEngine");
        engineRef.current = module.soundEngine;
        await engineRef.current.initialize();
        setInitialized(true);
      } catch (e) {
        console.warn("Sound engine init failed:", e);
      }
    })();
  }, [isSidebarLoaded]);

  const isAnyPlaying = Object.values(soundStates).some((s) => s?.enabled);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setVolumePopoverOpen(false);
      }
    };

    if (volumePopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [volumePopoverOpen]);

  const toggleSound = async (soundId: SoundId) => {
    const engine = engineRef.current;
    if (!engine) return;

    const current = soundStates[soundId];
    const newEnabled = !current.enabled;
    console.log('toggleSound:', soundId, 'current.enabled:', current.enabled, 'newEnabled:', newEnabled, 'masterEnabled:', masterEnabled);
    
    const newStates = {
      ...soundStates,
      [soundId]: { ...current, enabled: newEnabled },
    };
    
    if (newEnabled && masterEnabled) {
      console.log('Starting sound:', soundId);
      engine.setSoundVolume(soundId, current.volume);
      await engine.setSoundEnabled(soundId, true);
    } else {
      console.log('Stopping sound:', soundId);
      engine.setSoundEnabled(soundId, false);
    }
    
    setSoundStates(newStates);
  };

  const updateSoundVolume = (soundId: SoundId, volume: number) => {
    const engine = engineRef.current;
    const current = soundStates[soundId];
    
    if (current.enabled && masterEnabled && engine) {
      engine.setSoundVolume(soundId, volume);
    }
    
    setSoundStates({
      ...soundStates,
      [soundId]: { ...current, volume },
    });
  };

  const handleMasterToggle = async (enabled: boolean) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMasterEnabled(enabled);
      
      if (enabled) {
        for (const sound of SOUNDS) {
          const state = soundStates[sound.id];
          if (state?.enabled) {
            engine.setSoundVolume(sound.id, state.volume);
            await engine.setSoundEnabled(sound.id, true);
          }
        }
      } else {
        for (const sound of SOUNDS) {
          engine.setSoundEnabled(sound.id, false);
        }
      }
    }
    setMasterEnabled(enabled);
  };

  const handleMasterVolume = (volume: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMasterVolume(volume);
    }
    setMasterVolume(volume);
  };

  return (
    <div className="statusbar flex items-center justify-between h-8 shrink-0 bg-background text-[11px] text-muted-foreground w-full select-none">
      <div className="flex items-center gap-1.5 pl-2">
        <GitHubLogoIcon className="w-4 h-4" />
        <span>Files changed</span>
      </div>
      <div className="flex items-center">
        <Button variant="ghost" size="icon-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        </Button>
        <Button variant="ghost" size="icon-sm">
          <LightningBoltIcon className="w-5 h-5" />
        </Button>
        <div className="relative" ref={popoverRef}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={isAnyPlaying ? "text-primary" : ""}
            onClick={() => setVolumePopoverOpen(!volumePopoverOpen)}
          >
            {masterEnabled ? (
              <VolumeIcon className="w-5 h-5" />
            ) : (
              <VolumeMuteIcon className="w-5 h-5" />
            )}
          </Button>
          {volumePopoverOpen && (
            <div className="absolute bottom-full mb-2 right-0 p-3 bg-popover border rounded-md shadow-lg z-[9999]">
              <div className="space-y-2">
                {/* Master Controls */}
                <div className="flex items-center gap-4 pb-2 border-b">
                  <span className="text-sm font-medium w-28 whitespace-nowrap">Sound</span>
                  <Slider
                    value={[masterVolume]}
                    onValueChange={([v]) => handleMasterVolume(v)}
                    max={1}
                    step={0.01}
                    className="w-32 flex-1"
                    disabled={!masterEnabled}
                  />
                  <Switch
                    checked={masterEnabled}
                    onCheckedChange={handleMasterToggle}
                  />
                </div>

                {/* Sound List */}
                <div className="space-y-3 mt-3">
                  {SOUNDS.map((sound) => {
                    const soundState = soundStates[sound.id];
                    return (
                      <div
                        key={sound.id}
                        className="flex items-center gap-4"
                      >
                        <span className="text-sm w-28 whitespace-nowrap">{sound.name}</span>
                        <Slider
                          value={[soundState?.volume || 0.7]}
                          onValueChange={([v]) => updateSoundVolume(sound.id, v)}
                          max={1}
                          step={0.01}
                          className="w-32 flex-1"
                          disabled={!masterEnabled || !soundState?.enabled}
                        />
                        <Switch
                          checked={soundState?.enabled || false}
                          onCheckedChange={() => toggleSound(sound.id)}
                          disabled={!masterEnabled}
                          className="h-3 w-3"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => openSettingsPage("vaults")}>
          <MixerHorizontalIcon className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
