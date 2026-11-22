import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Single-line text that scrolls to reveal its overflowing end while the
 * nearest <button> ancestor is hovered or focused. Overflow is measured on
 * hover, so nothing runs while idle. Timing matches Mnemee: 150ms delay,
 * ease-in-out, ~50px/s (min 0.6s). Styles live in styles/marquee.css.
 */
export function MarqueeText({
  children,
  className,
  disabled = false,
}: {
  children: string;
  className?: string;
  disabled?: boolean;
}) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    const host = viewport?.closest<HTMLElement>("button");
    if (!viewport || !text || !host) return;

    const measure = () => {
      const distance = disabledRef.current
        ? 0
        : Math.max(0, text.offsetWidth - viewport.clientWidth + 4);
      host.style.setProperty("--marquee-distance", `${distance}px`);
      host.style.setProperty("--marquee-duration", `${Math.max(0.6, distance / 50)}s`);
      host.toggleAttribute("data-marquee-overflow", distance > 0);
    };
    const clear = () => host.removeAttribute("data-marquee-overflow");

    host.addEventListener("mouseenter", measure);
    host.addEventListener("focus", measure);
    host.addEventListener("mousedown", clear);
    return () => {
      host.removeEventListener("mouseenter", measure);
      host.removeEventListener("focus", measure);
      host.removeEventListener("mousedown", clear);
      clear();
    };
  }, []);

  return (
    <span ref={viewportRef} className={cn("marquee-viewport min-w-0 flex-1 overflow-hidden", className)}>
      <span ref={textRef} className="marquee-text block w-max whitespace-nowrap">
        {children}
      </span>
    </span>
  );
}
