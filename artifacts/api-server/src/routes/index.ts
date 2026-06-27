import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gmapsParserRouter from "./gmaps-parser";
import leadsRouter from "./leads.js";
import stripeRouter from "./stripe.js";
import userRouter from "./user.js";
import adminRouter from "./admin.js";
import chatRouter from "./chat.js";
import v1Router from "./v1.js";
import extRouter from "./ext.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gmapsParserRouter);
router.use("/leads", leadsRouter);
router.use("/stripe", stripeRouter);
router.use("/user", userRouter);
router.use("/admin", adminRouter);
router.use("/chat", chatRouter);
router.use("/v1", v1Router);

// Extension-facing routes — no prefix stripping; paths in ext.ts are full
router.use(extRouter);

export default router;
