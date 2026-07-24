import { useState } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Hero/thumbnail photo for a blog post, served from /api/blog/hero/<slug>.jpg
 * (AI-generated server-side for every post). Renders nothing until the image
 * actually loads and stays hidden if the post has no photo yet (404) — posts
 * without images look exactly like they did before.
 */
export function BlogPhoto({ slug, alt, className = "", imgClassName = "" }: {
  slug: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  if (state === "err") return null;
  return (
    <div className={`${className} ${state === "ok" ? "" : "hidden"}`}>
      <img
        src={`${API_BASE}/api/blog/hero/${slug}.jpg`}
        alt={alt}
        loading="lazy"
        className={imgClassName}
        onLoad={() => setState("ok")}
        onError={() => setState("err")}
      />
    </div>
  );
}
