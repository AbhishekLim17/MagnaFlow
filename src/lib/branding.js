// An organisation's look on the client portal: logo, accent colour, welcome note.
// Pure. Stored at organizations/{orgId}/branding/portal (see services/brandingService).

export const MAX_WELCOME = 500;
// The logo is kept in Firestore as a data URL (Cloud Storage needs the paid plan), so it is
// shrunk in the browser first (lib/imageResize); this is the hard cap the rules enforce too.
export const MAX_LOGO_CHARS = 150000;
const LOGO_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export const EMPTY_BRANDING = { accent: null, logo: null, welcome: '' };

/** '#abc', 'ABCDEF', ' #AbCdEf ' -> '#aabbcc' / '#abcdef'; anything else -> null. */
export const normalizeHex = (value) => {
  const s = String(value ?? '').trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s.split('').map((c) => c + c).join('')}`;
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return null;
};

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const h = normalizeHex(hex);
  if (!h) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colours (1 to 21). */
export const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const LIGHT_TEXT = '#ffffff';
// Pure black: a softer near-black cannot promise 4.5:1 on mid-grey accents (the worst case
// with black and white is about 4.58:1).
export const DARK_TEXT = '#000000';

/**
 * The text colour to put on an accent background: white or black, whichever reads
 * better. One of the two always reaches 4.5:1, so any accent the admin picks stays legible.
 */
export const textOn = (accent) =>
  (contrastRatio(accent, LIGHT_TEXT) >= contrastRatio(accent, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT);

/** Why a logo cannot be saved, or null. */
export const logoProblem = (dataUrl) => {
  if (!dataUrl) return null;
  if (!LOGO_PATTERN.test(dataUrl)) return 'Use a PNG, JPG, WebP or SVG image.';
  if (dataUrl.length > MAX_LOGO_CHARS) return 'That image is too detailed to store. Try a simpler logo or a smaller file.';
  return null;
};

/** The stored document, with every field present and anything malformed dropped. */
export const brandingFromDoc = (data) => ({
  accent: normalizeHex(data?.accent),
  logo: data?.logo && !logoProblem(data.logo) ? data.logo : null,
  welcome: typeof data?.welcome === 'string' ? data.welcome.slice(0, MAX_WELCOME) : '',
});

/** What to save: cleaned, so the rules never see a value they would refuse. */
export const brandingToDoc = ({ accent, logo, welcome }) => ({
  accent: normalizeHex(accent),
  logo: logo || null,
  welcome: String(welcome || '').trim().slice(0, MAX_WELCOME),
});
