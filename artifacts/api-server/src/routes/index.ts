// Legacy health route kept for compatibility
import { Router, type IRouter } from "express";
import healthRouter from "./health";

const router: IRouter = Router();
router.use(healthRouter);

export default router;
