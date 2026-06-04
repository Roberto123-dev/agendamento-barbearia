import { Request, Response } from "express";
import db from "../database/db";
import { AuthRequest } from "../middlewares/auth";

interface Servico {
    duracao_minutos: number;
}

interface Agendamento {
    hora_inicio: string;
    hora_fim: string;
}

interface HorarioTrabalho {
    hora_inicio: string;
    hora_fim: string;
}

// Converte "09:00" em minutos (540)
function horaParaMinutos(hora: string): number {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

// Converte minutos (540) em "09:00"
function minutosParaHora(minutos: number): string {
    const h = Math.floor(minutos / 60)
        .toString()
        .padStart(2, "0");
    const m = (minutos % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
}

// Retorna os slots disponíveis de um barbeiro em uma data
export function buscarSlotsDisponiveis(req: Request, res: Response) {
    const { barbeiro_id, data, servico_id } = req.query as Record<
        string,
        string
    >;

    if (!barbeiro_id || !data || !servico_id) {
        res.status(400).json({
            erro: "barbeiro_id, data e servico_id são obrigatórios",
        });
        return;
    }

    // Busca duração do serviço
    const servico = db
        .prepare(
            `
    SELECT duracao_minutos FROM servicos WHERE id = ?
  `,
        )
        .get(servico_id) as Servico | undefined;

    if (!servico) {
        res.status(404).json({ erro: "Serviço não encontrado" });
        return;
    }

    // Descobre o dia da semana da data informada (0=domingo, 6=sábado)
    const diaSemana = new Date(data + "T12:00:00").getDay();

    // Busca horário de trabalho do barbeiro nesse dia
    const horarioTrabalho = db
        .prepare(
            `
    SELECT hora_inicio, hora_fim
    FROM horarios_trabalho
    WHERE barbeiro_id = ? AND dia_semana = ?
  `,
        )
        .get(barbeiro_id, diaSemana) as HorarioTrabalho | undefined;

    if (!horarioTrabalho) {
        res.json({ slots: [], mensagem: "Barbeiro não trabalha neste dia" });
        return;
    }

    // Busca agendamentos existentes nessa data
    const agendamentos = db
        .prepare(
            `
    SELECT hora_inicio, hora_fim
    FROM agendamentos
    WHERE barbeiro_id = ? AND data = ? AND status != 'cancelado'
  `,
        )
        .all(barbeiro_id, data) as Agendamento[];

    // Busca bloqueios nessa data
    const bloqueios = db
        .prepare(
            `
    SELECT hora_inicio, hora_fim
    FROM bloqueios
    WHERE barbeiro_id = ? AND data = ?
  `,
        )
        .all(barbeiro_id, data) as Agendamento[];

    // Todos os horários ocupados (agendamentos + bloqueios)
    const ocupados = [...agendamentos, ...bloqueios];

    // Gera todos os slots possíveis
    const inicio = horaParaMinutos(horarioTrabalho.hora_inicio);
    const fim = horaParaMinutos(horarioTrabalho.hora_fim);
    const duracao = servico.duracao_minutos;
    const slots: string[] = [];

    for (let minuto = inicio; minuto + duracao <= fim; minuto += 30) {
        const slotInicio = minuto;
        const slotFim = minuto + duracao;

        // Verifica se o slot conflita com algum ocupado
        const conflito = ocupados.some((o) => {
            const ocupadoInicio = horaParaMinutos(o.hora_inicio);
            const ocupadoFim = horaParaMinutos(o.hora_fim);
            return slotInicio < ocupadoFim && slotFim > ocupadoInicio;
        });

        if (!conflito) {
            slots.push(minutosParaHora(slotInicio));
        }
    }

    res.json({ slots });
}

// Criar agendamento
export function criarAgendamento(req: Request, res: Response) {
    const {
        barbeiro_id,
        servico_id,
        cliente_nome,
        cliente_telefone,
        data,
        hora_inicio,
    } = req.body;

    if (
        !barbeiro_id ||
        !servico_id ||
        !cliente_nome ||
        !cliente_telefone ||
        !data ||
        !hora_inicio
    ) {
        res.status(400).json({ erro: "Todos os campos são obrigatórios" });
        return;
    }

    // Busca duração do serviço
    const servico = db
        .prepare(
            `
    SELECT duracao_minutos FROM servicos WHERE id = ?
  `,
        )
        .get(servico_id) as Servico | undefined;

    if (!servico) {
        res.status(404).json({ erro: "Serviço não encontrado" });
        return;
    }

    const horaFim = minutosParaHora(
        horaParaMinutos(hora_inicio) + servico.duracao_minutos,
    );

    // Verifica conflito antes de inserir (proteção contra race condition)
    const conflito = db
        .prepare(
            `
    SELECT id FROM agendamentos
    WHERE barbeiro_id = ?
      AND data = ?
      AND status != 'cancelado'
      AND hora_inicio < ?
      AND hora_fim > ?
  `,
        )
        .get(barbeiro_id, data, horaFim, hora_inicio);

    if (conflito) {
        res.status(409).json({ erro: "Horário não está mais disponível" });
        return;
    }

    // Insere o agendamento
    const resultado = db
        .prepare(
            `
    INSERT INTO agendamentos (barbeiro_id, servico_id, cliente_nome, cliente_telefone, data, hora_inicio, hora_fim)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
        )
        .run(
            barbeiro_id,
            servico_id,
            cliente_nome,
            cliente_telefone,
            data,
            hora_inicio,
            horaFim,
        );

    res.status(201).json({
        id: resultado.lastInsertRowid,
        mensagem: "Agendamento criado com sucesso",
        hora_fim: horaFim,
    });
}

// Listar agendamentos de um barbeiro por data
export function listarAgendamentos(req: Request, res: Response) {
    const { barbeiro_id, data } = req.query as Record<string, string>;

    if (!barbeiro_id || !data) {
        res.status(400).json({ erro: "barbeiro_id e data são obrigatórios" });
        return;
    }

    const agendamentos = db
        .prepare(
            `
    SELECT
      a.id,
      a.cliente_nome,
      a.cliente_telefone,
      a.data,
      a.hora_inicio,
      a.hora_fim,
      a.status,
      s.nome AS servico,
      s.preco
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    WHERE a.barbeiro_id = ? AND a.data = ?
    ORDER BY a.hora_inicio
  `,
        )
        .all(barbeiro_id, data);

    res.json(agendamentos);
}

// Cancelar agendamento
export function cancelarAgendamento(req: Request, res: Response) {
    const { id } = req.params;

    const agendamento = db
        .prepare(
            `
    SELECT id, status FROM agendamentos WHERE id = ?
  `,
        )
        .get(id) as { id: number; status: string } | undefined;

    if (!agendamento) {
        res.status(404).json({ erro: "Agendamento não encontrado" });
        return;
    }

    if (agendamento.status === "cancelado") {
        res.status(400).json({ erro: "Agendamento já está cancelado" });
        return;
    }

    db.prepare(
        `
    UPDATE agendamentos SET status = 'cancelado' WHERE id = ?
  `,
    ).run(id);

    res.json({ mensagem: "Agendamento cancelado com sucesso" });
}

export function concluirAgendamento(req: Request, res: Response) {
    const { id } = req.params;

    const agendamento = db
        .prepare(
            `
    SELECT id, status FROM agendamentos WHERE id = ?
  `,
        )
        .get(id) as { id: number; status: string } | undefined;

    if (!agendamento) {
        res.status(404).json({ erro: "Agendamento não encontrado" });
        return;
    }

    if (agendamento.status !== "confirmado") {
        res.status(400).json({
            erro: "Apenas agendamentos confirmados podem ser concluídos",
        });
        return;
    }

    db.prepare(
        `
    UPDATE agendamentos SET status = 'concluido' WHERE id = ?
  `,
    ).run(id);

    res.json({ mensagem: "Agendamento concluído com sucesso" });
}

export function limparAgendamentosAntigos(req: AuthRequest, res: Response) {
    const { ate_data } = req.body;

    if (!ate_data) {
        res.status(400).json({ erro: "ate_data é obrigatório" });
        return;
    }

    const resultado = db
        .prepare(
            `
    DELETE FROM agendamentos WHERE data <= ?
  `,
        )
        .run(ate_data);

    res.json({
        mensagem: "Limpeza concluída",
        removidos: resultado.changes,
    });
}

export function resumoPeriodo(req: AuthRequest, res: Response) {
    const { barbeiro_id, data_inicio, data_fim } = req.query as Record<
        string,
        string
    >;

    if (!barbeiro_id || !data_inicio || !data_fim) {
        res.status(400).json({
            erro: "barbeiro_id, data_inicio e data_fim são obrigatórios",
        });
        return;
    }

    const agendamentos = db
        .prepare(
            `
    SELECT
      a.id,
      a.data,
      a.hora_inicio,
      a.hora_fim,
      a.status,
      a.cliente_nome,
      a.cliente_telefone,
      s.nome AS servico,
      s.preco
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    WHERE a.barbeiro_id = ?
      AND a.data >= ?
      AND a.data <= ?
    ORDER BY a.data, a.hora_inicio
  `,
        )
        .all(barbeiro_id, data_inicio, data_fim) as any[];

    const total = agendamentos.length;
    const concluidos = agendamentos.filter(
        (a) => a.status === "concluido",
    ).length;
    const cancelados = agendamentos.filter(
        (a) => a.status === "cancelado",
    ).length;
    const receita = agendamentos
        .filter((a) => a.status === "concluido")
        .reduce((acc, a) => acc + a.preco, 0);

    res.json({
        agendamentos,
        resumo: { total, concluidos, cancelados, receita },
    });
}

export function deletarAgendamento(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const agendamento = db
        .prepare(
            `
    SELECT id FROM agendamentos WHERE id = ?
  `,
        )
        .get(id);

    if (!agendamento) {
        res.status(404).json({ erro: "Agendamento não encontrado" });
        return;
    }

    db.prepare(`DELETE FROM agendamentos WHERE id = ?`).run(id);

    res.json({ mensagem: "Agendamento deletado" });
}
