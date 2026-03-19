import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nodesRouter from "./nodes";
import sitesRouter from "./sites";
import statsRouter from "./stats";
import authRouter from "./auth";
import storageRouter from "./storage";
import deployRouter from "./deploy";
import federationRouter from "./federation";
import capacityRouter from "./capacity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(deployRouter);
router.use(federationRouter);
router.use(capacityRouter);
router.use(nodesRouter);
router.use(sitesRouter);
router.use(statsRouter);

export default router;
