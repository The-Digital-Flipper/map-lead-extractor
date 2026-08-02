import { Router, type IRouter } from "express";
import { getPostImage } from "../lib/social";
import { publicImageSigValid } from "../lib/tiktok";
import healthRouter from "./health";
import gmapsParserRouter from "./gmaps-parser";
import leadsRouter from "./leads.js";
import collectionsRouter from "./collections.js";
import stripeRouter from "./stripe.js";
import userRouter from "./user.js";
import adminRouter from "./admin.js";
import scraperRouter from "./scraper.js";
import chatRouter from "./chat.js";
import v1Router from "./v1.js";
import extRouter from "./ext.js";
import smsRouter from "./sms.js";
import trackRouter from "./track.js";
import outreachRouter from "./outreach.js";
import blogRouter from "./blog.js";
import testimonialsRouter from "./testimonials.js";

const router: IRouter = Router();

// Public (unauthenticated) ad-image URL — TikTok's PULL_FROM_URL downloads
// photo media itself, so DB-stored post images need a public route. Guarded
// by an HMAC of the post id (see lib/tiktok.ts) so it can't be enumerated.
router.get("/social-image/:file", async (req, res) => {
  const m = /^(\d+)\.png$/.exec(String(req.params.file ?? ""));
  const id = m ? Number(m[1]) : NaN;
  const sig = String(req.query.sig ?? "");
  if (!Number.isFinite(id) || !sig || !(await publicImageSigValid(id, sig))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const img = await getPostImage(id);
  if (!img) { res.status(404).json({ error: "Not found" }); return; }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(img);
});

router.use(healthRouter);
router.use(gmapsParserRouter);
router.use("/leads", leadsRouter);
router.use("/collections", collectionsRouter);
router.use("/stripe", stripeRouter);
router.use("/user", userRouter);
router.use("/admin", adminRouter);
router.use("/scraper", scraperRouter);
router.use("/chat", chatRouter);
router.use("/v1", v1Router);
router.use("/sms", smsRouter);
router.use("/outreach", outreachRouter);
router.use("/blog", blogRouter);
router.use("/testimonials", testimonialsRouter);
router.use(trackRouter);

// Extension-facing routes — no prefix stripping; paths in ext.ts are full
router.use(extRouter);

export default router;
