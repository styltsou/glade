import { cloneElement, type ReactElement } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * How icons trade places: the outgoing one fades, blurs a little and shrinks
 * as the incoming one comes in sharp, quickly enough not to hold up the click.
 * A CSS transition, so a second change midway turns it around instead of
 * starting over. Exported for swaps CSS drives itself (on hover).
 */
export const SWAP = "transition-[opacity,filter,scale] duration-150 ease-(--ease-ui) motion-reduce:transition-none";
export const SHOWN = "opacity-100 blur-none scale-100";
export const HIDDEN = "opacity-0 blur-[2px] scale-[0.6]";

/**
 * One of several icons, picked by `show`, crossfading when it changes. They
 * all sit in the same spot, so the button never shifts.
 */
export function IconSwap<K extends string>({
	show,
	icons,
	className,
}: {
	show: K;
	icons: Record<K, ReactElement<{ className?: string }>>;
	className?: string;
}) {
	return (
		<span aria-hidden className={cn("inline-grid shrink-0 place-items-center *:col-start-1 *:row-start-1", className)}>
			{(Object.entries(icons) as [K, ReactElement<{ className?: string }>][]).map(([key, icon]) =>
				cloneElement(icon, { key, className: cn(SWAP, key === show ? SHOWN : HIDDEN, icon.props.className) }),
			)}
		</span>
	);
}

/** A copy button's icon, which turns into a check once copied and back again. */
export function CopyIcon({ copied, className }: { copied: boolean; className?: string }) {
	return (
		<IconSwap show={copied ? "check" : "copy"} icons={{ copy: <Copy className={className} />, check: <Check className={className} /> }} />
	);
}
