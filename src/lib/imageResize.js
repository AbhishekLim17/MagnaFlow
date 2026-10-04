// Shrink an uploaded image in the browser so it fits in a Firestore document (logos; Cloud
// Storage needs the paid plan). Any image the browser can draw, SVG included, comes out as a
// plain raster data URL, which also strips anything an SVG might carry besides pixels.

const load = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image we can read.")); };
  img.src = url;
});

/**
 * @param {File} file
 * @param {{ maxSize?: number, maxChars?: number }} [options]  longest side in px; size cap of the result
 * @returns {Promise<string>} a PNG data URL, or WebP when the PNG would be too large
 */
export const shrinkImageToDataUrl = async (file, { maxSize = 256, maxChars = 150000 } = {}) => {
  const img = await load(file);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || maxSize, img.naturalHeight || maxSize));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((img.naturalWidth || maxSize) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL('image/png');
  if (png.length <= maxChars) return png;
  // Photographic logos compress far better as WebP (it keeps transparency too).
  return canvas.toDataURL('image/webp', 0.85);
};
