import { useState, useEffect, useRef, useId } from "react";
import { Headphones, Volume2 } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { SOUNDS, type SoundId } from "@/lib/sounds";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { soundEngine as SoundEngineType } from "@/lib/soundEngine";

/** Stays mounted in the window bar so closing the mixer never stops playback. */
export function AmbientSounds() {
  const soundStates = useStore((state) => state.soundStates);
  const setSoundStates = useStore((state) => state.setSoundStates);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [initialized, setInitialized] = useState(false);
  const engineRef = useRef<typeof SoundEngineType | null>(null);
  const titleId = useId();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { soundEngine } = await import("@/lib/soundEngine");
        engineRef.current = soundEngine;
        await soundEngine.initialize();
        if (mounted) setInitialized(true);
      } catch (error) {
        console.warn("Sound engine init failed:", error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const playing = masterEnabled && Object.values(soundStates).some((state) => state?.enabled);

  const toggleSound = async (soundId: SoundId, enabled: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    const current = soundStates[soundId];
    setSoundStates({ ...soundStates, [soundId]: { ...current, enabled } });
    engine.setSoundVolume(soundId, current.volume);
    await engine.setSoundEnabled(soundId, enabled && masterEnabled);
  };

  const updateSoundVolume = (soundId: SoundId, volume: number) => {
    engineRef.current?.setSoundVolume(soundId, volume);
    setSoundStates({ ...soundStates, [soundId]: { ...soundStates[soundId], volume } });
  };

  const handleMasterToggle = async (enabled: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    setMasterEnabled(enabled);
    engine.setMasterEnabled(enabled);
    engine.setMasterVolume(enabled ? masterVolume : 0);
    for (const sound of SOUNDS) {
      const state = soundStates[sound.id];
      engine.setSoundVolume(sound.id, state.volume);
      await engine.setSoundEnabled(sound.id, enabled && state.enabled);
    }
  };

  const handleMasterVolume = (volume: number) => {
    engineRef.current?.setMasterVolume(masterEnabled ? volume : 0);
    setMasterVolume(volume);
  };

  return (
    <Popover>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={playing ? "Ambient sounds playing" : "Ambient sounds"}
              data-no-drag
              className={cn(
                "press flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground data-[state=open]:bg-foreground/[0.07]",
                playing && "text-primary",
              )}
            >
              <Headphones className="size-4" />
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">Ambient sounds</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" side="bottom" sideOffset={8} className="w-80 max-w-[calc(100vw-1rem)] rounded-lg" aria-labelledby={titleId} data-no-drag>
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-sm font-semibold">Ambient sounds</h2>
          <Switch aria-label="Play ambient sounds" checked={masterEnabled} onCheckedChange={handleMasterToggle} disabled={!initialized} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
          <Slider aria-label="Master volume" value={[masterVolume]} onValueChange={([volume]) => handleMasterVolume(volume)} max={1} step={0.01} disabled={!masterEnabled} className="flex-1" />
          <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{Math.round(masterVolume * 100)}%</span>
        </div>
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {SOUNDS.map((sound) => {
            const state = soundStates[sound.id];
            return (
              <div key={sound.id} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
                <span className="text-xs">{sound.name}</span>
                <Slider aria-label={`${sound.name} volume`} value={[state.volume]} onValueChange={([volume]) => updateSoundVolume(sound.id, volume)} max={1} step={0.01} disabled={!masterEnabled || !state.enabled} />
                <Switch aria-label={sound.name} checked={state.enabled} onCheckedChange={(enabled) => toggleSound(sound.id, enabled)} disabled={!masterEnabled} size="sm" />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
