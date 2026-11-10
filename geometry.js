/* MEETKUNDE — hoekgrepen schalen een afbeelding rond de tegenoverliggende hoek. */
(function (root) {
  'use strict';

  function corners(bounds) {
    return [
      { x: bounds.x, y: bounds.y, sx: -1, sy: -1 },
      { x: bounds.x + bounds.width, y: bounds.y, sx: 1, sy: -1 },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, sx: 1, sy: 1 },
      { x: bounds.x, y: bounds.y + bounds.height, sx: -1, sy: 1 }
    ];
  }

  function resizeFromCorner(bounds, corner, pointer, canvasWidth, canvasHeight) {
    const ratio = bounds.height / bounds.width;
    const anchorX = corner.sx < 0 ? bounds.x + bounds.width : bounds.x;
    const anchorY = corner.sy < 0 ? bounds.y + bounds.height : bounds.y;
    // Projecteer de muisbeweging op de diagonaal: verhouding blijft exact gelijk.
    const dx = (pointer.x - anchorX) * corner.sx;
    const dy = (pointer.y - anchorY) * corner.sy;
    const proposedWidth = (dx + dy * ratio) / (1 + ratio * ratio);
    // Houd het middelpunt binnen het lot; afsnijden aan de rand blijft toegestaan.
    const roomX = 2 * (corner.sx > 0 ? canvasWidth - anchorX : anchorX);
    const roomY = 2 * (corner.sy > 0 ? canvasHeight - anchorY : anchorY) / ratio;
    const maximum = Math.min(canvasWidth, roomX, roomY);
    const width = Math.max(canvasWidth * 0.02, Math.min(maximum, proposedWidth));
    return {
      x: Math.max(0, Math.min(1, (anchorX + corner.sx * width / 2) / canvasWidth)),
      y: Math.max(0, Math.min(1, (anchorY + corner.sy * width * ratio / 2) / canvasHeight)),
      width: width / canvasWidth
    };
  }

  const api = { corners, resizeFromCorner };
  if (typeof module !== 'undefined') module.exports = api;
  else root.StudioGeometry = api;
})(globalThis);
