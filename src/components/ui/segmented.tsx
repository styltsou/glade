import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { animate, motion, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/** The thumb's slide between options (as in mnemee's segmented tabs). */
export const SEGMENT_SLIDE_MS = 180;
const THUMB_MOTION = { duration: SEGMENT_SLIDE_MS / 1000, ease: [0.22, 1, 0.36, 1] as const };

/** Same box for an option and its accent copy, so the two line up exactly. */
const OPTION_BOX = "flex h-full items-center justify-center gap-1.5 px-2.5 text-[13px]";

type Thumb = { x: MotionValue<number>; width: MotionValue<number> };
const ThumbContext = createContext<Thumb | null>(null);

/** The option element for `value`, among the root's options. */
function optionFor(root: HTMLElement, value: string) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-option]")).find((el) => el.dataset.option === value);
}

/**
 * A row of mutually exclusive choices; one is always picked.
 *
 * An accent thumb slides under the picked option. Each option holds a copy of
 * its label in the accent's text colour, clipped to wherever the thumb is, so
 * the text changes colour exactly as the thumb passes over it instead of
 * fading.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: ReactNode }[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const thumb = useMemo(() => ({ x, width }), [x, width]);
  const placed = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Slide to a newly picked option; land on the first one without moving.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const option = root && optionFor(root, value);
    if (!option) return;
    if (!placed.current || reduceMotion) {
      placed.current = true;
      x.jump(option.offsetLeft);
      width.jump(option.offsetWidth);
      return;
    }
    animate(x, option.offsetLeft, THUMB_MOTION);
    animate(width, option.offsetWidth, THUMB_MOTION);
  }, [value, reduceMotion, x, width]);

  // Follow size changes (fonts loading) at once: only a new pick slides.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const option = optionFor(root, valueRef.current);
      if (!option || (option.offsetLeft === x.get() && option.offsetWidth === width.get())) return;
      x.jump(option.offsetLeft);
      width.jump(option.offsetWidth);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [x, width]);

  return (
    <ThumbContext.Provider value={thumb}>
      <ToggleGroupPrimitive.Root
        ref={rootRef}
        type="single"
        aria-label={label}
        value={value}
        // Clicking the picked option would clear it; keep it picked.
        onValueChange={(v) => v && onChange(v as T)}
        className={cn("relative flex h-8 items-center gap-0.5 rounded-lg bg-foreground/[0.06] p-0.5", className)}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-md bg-primary shadow-xs"
          style={{ x, width }}
        />
        {options.map((o) => (
          <SegmentedOption key={o.id} value={o.id}>
            {o.label}
          </SegmentedOption>
        ))}
      </ToggleGroupPrimitive.Root>
    </ThumbContext.Provider>
  );
}

function SegmentedOption({ value, children }: { value: string; children: ReactNode }) {
  const thumb = useContext(ThumbContext)!;
  const ref = useRef<HTMLButtonElement>(null);
  const left = useMotionValue(0);
  const width = useMotionValue(0);

  // Where this option sits in the row; siblings can move it without resizing it.
  useLayoutEffect(() => {
    const option = ref.current;
    const root = option?.parentElement;
    if (!option || !root) return;
    const measure = () => {
      left.set(option.offsetLeft);
      width.set(option.offsetWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(option);
    return () => observer.disconnect();
  }, [left, width]);

  // Clip the accent copy to the part of this option the thumb covers. Written
  // straight to the element, on every change and whenever this effect runs:
  // a derived motion value missed its first update under StrictMode's double
  // mount, leaving the picked option in grey text on the accent.
  const accentRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const accent = accentRef.current;
    if (!accent) return;
    const clip = () => {
      const thumbX = thumb.x.get();
      const thumbWidth = thumb.width.get();
      const optionLeft = left.get();
      const optionWidth = width.get();
      // Clamped at the option's sides: opposing insets that add up to more
      // than its width clip it away entirely.
      const fromLeft = Math.max(0, thumbX - optionLeft);
      const fromRight = Math.max(0, optionLeft + optionWidth - thumbX - thumbWidth);
      accent.style.clipPath =
        thumbWidth && optionWidth ? `inset(0 ${fromRight}px 0 ${fromLeft}px round var(--radius-md))` : "inset(50%)";
    };
    clip();
    const stops = [thumb.x, thumb.width, left, width].map((value) => value.on("change", clip));
    return () => stops.forEach((stop) => stop());
  }, [thumb, left, width]);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      value={value}
      data-option={value}
      className={cn(
        OPTION_BOX,
        "relative cursor-pointer rounded-md text-muted-foreground outline-none transition-colors duration-100",
        // The picked option already shows the hover colour, so hovering it changes nothing.
        "hover:text-foreground data-[state=on]:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
      )}
    >
      {children}
      <span
        ref={accentRef}
        aria-hidden
        className={cn(OPTION_BOX, "pointer-events-none absolute inset-0 text-primary-foreground")}
      >
        {children}
      </span>
    </ToggleGroupPrimitive.Item>
  );
}
