import { Router } from "express";
import {
    salvarSubscription,
    deletarSubscription,
} from "../controllers/pushController";
import { autenticar } from "../middlewares/auth";

const router = Router();

router.post("/subscription", autenticar, salvarSubscription);
router.delete("/subscription", autenticar, deletarSubscription);

export default router;
