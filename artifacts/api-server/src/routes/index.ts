import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gmapsParserRouter from "./gmaps-parser";
import leadsRouter from "./leads.js";
import stripeRouter from "./stripe.js";
import userRouter from "./user.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gmapsParserRouter);
router.use("/leads", leadsRouter);
router.use("/stripe", stripeRouter);
router.use("/user", userRouter);
router.use("/admin", adminRouter);

export default router;
