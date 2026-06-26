import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gmapsParserRouter from "./gmaps-parser";
import leadsRouter from "./leads.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gmapsParserRouter);
router.use("/leads", leadsRouter);

export default router;
