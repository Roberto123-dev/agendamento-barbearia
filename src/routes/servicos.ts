import { Router } from "express";
import {
    listarServicos,
    buscarServico,
} from "../controllers/servicosController";

const router = Router();

router.get("/", listarServicos);
router.get("/:id", buscarServico);

export default router;
