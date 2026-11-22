type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** Keep the scaled image covering its viewport; center any axis that fits. */
export function constrainImagePan(position: Point, scale: number, image: Size, viewport: Size): Point {
  const limitX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const limitY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return {
    x: Math.min(limitX, Math.max(-limitX, position.x)),
    y: Math.min(limitY, Math.max(-limitY, position.y)),
  };
}
