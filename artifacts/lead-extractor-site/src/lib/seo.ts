import { useEffect } from "react";

const SITE = "https://mapleadextractor.net";

interface SeoOptions {
  title: string;
  description?: string;
  /** Path like "/pricing" — becomes the canonical + og:url. Defaults to "/". */
  path?: string;
}

// Sets per-route title / description / canonical so each page is indexed
// distinctly (a single-page app otherwise shows one static title everywhere).
export function useSeo({ title, description, path = "/" }: SeoOptions) {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", SITE + path);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setCanonical(SITE + path);
  }, [title, description, path]);
}

function setMeta(attr: "name" | "property", key: string, content?: string) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
