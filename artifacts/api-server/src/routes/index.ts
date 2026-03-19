import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nodesRouter from "./nodes";
import sitesRouter from "./sites";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nodesRouter);
router.use(sitesRouter);
router.use(statsRouter);

export default router;
