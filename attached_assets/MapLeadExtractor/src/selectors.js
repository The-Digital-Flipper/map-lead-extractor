export const BING_SELECTOR_VERSION = "2026-06-23.1";

// Every selector here touches Bing-owned DOM and is breakage-prone.
// Keep all Bing layout knowledge in this file so a redesign is a one-file fix.
export const BING_LAYOUTS = [
  {
    id: "new",
    label: "Bing Maps modern results",
    priority: 1,
    detectors: [
      "#appShellRoot",
      ".b_lstcards",
      ".listingsPanel",
      "[data-automation-id='resultsList']"
    ],
    listContainer: [
      ".b_lstcards",
      ".listingsPanel",
      "[data-automation-id='resultsList']",
      "[class*='resultsList']",
      "[class*='listingsPanel']"
    ],
    listItems: [
      "[data-entity]",
      "li[data-key]",
      "[data-entity-id]",
      "li .b_split_card",
      "button [class*='listingContent']",
      "[class*='listingContent']"
    ],
    scrollContainer: [
      ".b_lstcards",
      ".b_split_cards_cont",
      "[data-automation-id='resultsList']",
      "[class*='resultsList']",
      "[class*='listingsPanel']"
    ],
    searchThisAreaButton: [
      "button[data-automation-id='searchThisAreaButton']",
      "button[class*='searchThisAreaButton']",
      "[class*='searchThisAreaButton'][role='button']",
      "button[aria-label*='Search this area']",
      "button[data-bm='137']"
    ],
    bottomLoadMoreButton: [
      "button[aria-label*='More results']",
      "button[aria-label*='Load more']",
      "button[aria-label*='Show more']",
      "button[class*='loadMore']",
      "button[class*='showMore']",
      "[role='button'][aria-label*='More results']",
      "[role='button'][aria-label*='Load more']",
      "[role='button'][aria-label*='Show more']"
    ],
    nextPageButton: [
      "a.bm_rightChevron",
      "button[aria-label*='Next']",
      "a[aria-label*='Next']"
    ],
    loadingIndicators: [
      ".b_waitlayer",
      ".bm_waitlayer",
      "[class*='waitlayer']",
      "[class*='loading']",
      "[class*='spinner']",
      "[class*='loader']",
      "[class*='pageSkeletonContainer']",
      "[class*='skeletonItemRoot']"
    ]
  },
  {
    id: "legacy",
    label: "Bing Maps legacy results",
    priority: 2,
    detectors: [
      ".b_vList",
      ".bm_oneMap",
      ".entity-listing-container"
    ],
    listContainer: [
      ".b_vList",
      ".entity-listing-container",
      ".bm_oneMap"
    ],
    listItems: [
      "a.listings-item[data-entity]",
      "[data-entity]",
      "li a",
      ".entity-listing"
    ],
    scrollContainer: [
      ".b_vList",
      ".entity-listing-container",
      ".bm_oneMap"
    ],
    searchThisAreaButton: [
      "button[aria-label*='Search this area']",
      "button[data-bm='137']"
    ],
    bottomLoadMoreButton: [
      "button[aria-label*='More results']",
      "button[aria-label*='Load more']",
      "button[aria-label*='Show more']",
      "[role='button'][aria-label*='More results']",
      "[role='button'][aria-label*='Load more']",
      "[role='button'][aria-label*='Show more']"
    ],
    nextPageButton: [
      "a.bm_rightChevron",
      "button[aria-label*='Next']",
      "a[aria-label*='Next']"
    ],
    loadingIndicators: [
      ".bm_waitlayer",
      ".b_waitlayer",
      "[class*='loading']"
    ]
  }
];
