export type DropPosition = 'top' | 'bottom' | 'into' | null;

const HEADER_HEIGHT = 32;
const THRESHOLD = 6;

export function calculateDropPosition(
  isOver: boolean,
  active: { rect: { current: { translated: { top: number; height: number } | null } } } | null,
  over: { rect: { top: number; height: number } } | null,
  isFolder: boolean,
  isExpanded: boolean
): DropPosition {
  if (!isOver || !active || !over) {
    return null;
  }

  const overRect = over.rect;
  const activeRect = active.rect.current.translated;

  if (!overRect || !activeRect) {
    return null;
  }

  const overTop = overRect.top;
  const overHeight = overRect.height;
  const activeCenter = activeRect.top + activeRect.height / 2;

  if (isFolder) {
    const distFromTop = activeCenter - overTop;
    if (distFromTop < THRESHOLD) {
      return 'top';
    } else if (distFromTop > HEADER_HEIGHT - THRESHOLD) {
      if (!isExpanded) return 'bottom';
      return 'into';
    }
    return 'into';
  }

  const relativePos = (activeCenter - overTop) / overHeight;
  return relativePos < 0.5 ? 'top' : 'bottom';
}

export function isDropIntoFolder(dropPosition: DropPosition, isFolder: boolean): boolean {
  return dropPosition === 'into' && isFolder;
}
