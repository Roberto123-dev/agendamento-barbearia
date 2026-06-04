import { Router } from "express";
import {
    buscarSlotsDisponiveis,
    criarAgendamento,
    listarAgendamentos,
    cancelarAgendamento,
    concluirAgendamento,
    limparAgendamentosAntigos,
    resumoPeriodo,
    deletarAgendamento,
} from "../controllers/agendamentosController";
import { autenticar } from "../middlewares/auth";

const router = Router();

// Rotas públicas — usadas pelo cliente
router.get("/slots", buscarSlotsDisponiveis);
router.post("/", criarAgendamento);

// Rotas protegidas — usadas apenas pelo painel do barbeiro
router.get("/", autenticar, listarAgendamentos);
router.patch("/:id/cancelar", autenticar, cancelarAgendamento);
router.patch("/:id/concluir", autenticar, concluirAgendamento);
router.delete("/limpar", autenticar, limparAgendamentosAntigos);
router.get("/periodo", autenticar, resumoPeriodo);
router.delete("/:id", autenticar, deletarAgendamento);

export default router;
