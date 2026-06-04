import { Router } from "express";
import {
    listarBloqueios,
    criarBloqueio,
    deletarBloqueio,
} from "../controllers/bloqueiosController";
import { autenticar } from "../middlewares/auth";

const router = Router();

router.get("/", listarBloqueios);
router.post("/", autenticar, criarBloqueio);
router.delete("/:id", autenticar, deletarBloqueio);

export default router;
