import { Search } from "lucide-react";
import { SiGooglemaps, SiYelp } from "react-icons/si";
import type { IconType } from "react-icons";

export type ScraperPlatform = "google_maps" | "yelp" | "bing_maps";

// Bing has no brand mark in our icon set (Simple Icons doesn't carry one) —
// falls back to a plain search glyph rather than a wrong/unofficial logo.
function BingIcon(props: { className?: string }) {
  return <Search className={props.className} />;
}

export interface ScraperActor {
  slug: string;
  platform: ScraperPlatform;
  Icon: IconType;
  iconColor: string;
  name: string;
  id: string;
  description: string;
  category: "lead-generation" | "social-media" | "e-commerce";
  live: boolean;
  // Placeholder social proof (not backed by a real review system yet) — shown
  // the way Apify's store shows stars + review count under each card.
  rating: number;
  reviews: number;
}

// Single source of truth for both the Store grid and the actor console page.
export const SCRAPER_ACTORS: ScraperActor[] = [
  {
    slug: "google-maps",
    platform: "google_maps",
    Icon: SiGooglemaps,
    iconColor: "text-[#4285F4]",
    name: "Google Maps Scraper",
    id: "you/google-maps-scraper",
    description: "Extract business name, phone, website, address and rating from Google Maps for any search term + location. Optional email & social enrichment from each business's own site.",
    category: "lead-generation",
    live: true,
    rating: 4.8,
    reviews: 236,
  },
  {
    slug: "yelp",
    platform: "yelp",
    Icon: SiYelp,
    iconColor: "text-[#D32323]",
    name: "Yelp Business Scraper",
    id: "you/yelp-business-scraper",
    description: "Pull business name, address, rating and review count from Yelp search results.",
    category: "lead-generation",
    live: true,
    rating: 4.7,
    reviews: 33,
  },
  {
    slug: "bing-maps",
    platform: "bing_maps",
    Icon: BingIcon,
    iconColor: "text-[#008373]",
    name: "Bing Maps Scraper",
    id: "you/bing-maps-scraper",
    description: "Extract business name, phone, website, address and rating from Bing Maps for any search term + location.",
    category: "lead-generation",
    live: true,
    rating: 4.6,
    reviews: 18,
  },
];

export function getActor(slug: string | undefined): ScraperActor | undefined {
  return SCRAPER_ACTORS.find(a => a.slug === slug);
}
