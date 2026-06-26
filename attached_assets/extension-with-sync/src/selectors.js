export const GOOGLE_SELECTOR_VERSION = "2026-06-26.1";

// Every selector here touches Google Maps' obfuscated DOM and is breakage-prone.
// Google renames these classes often — if extraction breaks, start HERE.
// Each entry is an ordered fallback list; the first match wins.
export const GOOGLE_SELECTORS = {
  // The scrollable results list ("feed").
  feed: [
    'div[role="feed"]',
    '[role="main"] div[role="feed"]',
    'div.m6QErb[aria-label]',
    'div.m6QErb.DxyBCb'
  ],
  // Each business result is anchored by a link to a /maps/place/ URL.
  placeLink: [
    'a.hfpxzc',
    'a[href*="/maps/place/"]'
  ],
  // The card container around a place link.
  card: [
    'div.Nv2PK',
    'div.bfdHYd',
    'div.lI9IFe'
  ],
  // Business name text (fallback if the link's aria-label is empty).
  name: [
    'div.qBF1Pd',
    'div.fontHeadlineSmall',
    'div.NrDZNb'
  ],
  // Star-rating element (its aria-label holds "4.5 stars 1,234 reviews").
  ratingImg: [
    'span[role="img"][aria-label*="star"]',
    'span[role="img"][aria-label*="Star"]'
  ],
  ratingValue: ['span.MW4etd', 'span.fontBodyMedium > span'],
  reviewCount: ['span.UY7F9'],
  // Website link inside the card (not the directions/call buttons).
  website: [
    'a[data-value="Website"]',
    'a[aria-label^="Visit"]',
    'a.lcr4fd[href]:not([href*="google."])'
  ],
  // Phone number shown on a list card (when Google displays it).
  phone: ['span.UsdlK', '.UsdlK'],
  // Info rows holding "Category · Address" and "Hours · Phone".
  infoRows: ['div.W4Efsd'],
  // "You've reached the end of the list" marker.
  endOfList: ['span.HlvSq', 'div.PbZDve'],
  // "Search this area" button that appears after panning the map.
  searchThisArea: [
    'button.qk5Wte',
    'button[jsaction*="searchbox"]',
    'button[aria-label*="Search this area"]'
  ],
  // Loading spinners.
  loading: ['div.qjESne', 'div.lXJj5c', '[class*="loading"]'],

  // --- Detail pane (opened when you click a place) — for deep-details mode ---
  detailTitle: ['h1.DUwDvf', 'h1.fontHeadlineLarge', 'div[role="main"] h1'],
  detailPhone: ['button[data-item-id^="phone:tel:"]', 'button[aria-label^="Phone:"]'],
  detailWebsite: ['a[data-item-id="authority"]', 'a[aria-label^="Website:"]'],
  detailAddress: ['button[data-item-id="address"]', 'button[aria-label^="Address:"]'],
  back: ['button[aria-label="Back"]', 'button.hYBOP', 'button[jsaction*="back"]']
};
