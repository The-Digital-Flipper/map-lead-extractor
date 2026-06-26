import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gmapsParserRouter from "./gmaps-parser";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gmapsParserRouter);

export default router;
