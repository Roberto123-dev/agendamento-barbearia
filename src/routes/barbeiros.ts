import { Router } from "express";
import {
    listarBarbeiros,
    buscarBarbeiro,
    buscarHorarios,
    cadastrarBarbeiro,
    deletarBarbeiro,
} from "../controllers/barbeirosController";
import { autenticar } from "../middlewares/auth";

const router = Router();

router.get("/", listarBarbeiros);
router.get("/:id", buscarBarbeiro);
router.get("/:id/horarios", buscarHorarios);
router.post("/", autenticar, cadastrarBarbeiro);
router.delete("/:id", autenticar, deletarBarbeiro);

export default router;
