// AGENDAMENTOS.TS
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
    diasComAgendamento,
} from "../controllers/agendamentosController";
import { autenticar } from "../middlewares/auth";
import {
    buscarHorarios,
    salvarHorarios,
} from "../controllers/barbeirosController";

const router = Router();

// ── Públicas ──────────────────────────────────────────
router.get("/slots", buscarSlotsDisponiveis);
router.post("/", criarAgendamento);

// ── Paths fixos primeiro (protegidas) ─────────────────
router.get("/", autenticar, listarAgendamentos);
router.get("/periodo", autenticar, resumoPeriodo);
router.get("/dias-com-agendamento", autenticar, diasComAgendamento);
router.delete("/limpar", autenticar, limparAgendamentosAntigos);

// ── Parâmetro dinâmico por último ─────────────────────
router.patch("/:id/cancelar", autenticar, cancelarAgendamento);
router.patch("/:id/concluir", autenticar, concluirAgendamento);
router.delete("/:id", autenticar, deletarAgendamento);

// Adicione no router:
router.get("/:id/horarios", buscarHorarios);
router.put("/:id/horarios", autenticar, salvarHorarios);

export default router;
