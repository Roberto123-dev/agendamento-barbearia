// AGENDAMENTOSCONTROLLER.TS
import { Request, Response } from "express";
import pool from "../database/db";
import { AuthRequest } from "../middlewares/auth";

function horaParaMinutos(hora: string): number {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function minutosParaHora(minutos: number): string {
    const h = Math.floor(minutos / 60)
        .toString()
        .padStart(2, "0");
    const m = (minutos % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
}

export async function buscarSlotsDisponiveis(req: Request, res: Response) {
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

    const { rows: servicos } = await pool.query(
        "SELECT duracao_minutos FROM servicos WHERE id = $1",
        [servico_id],
    );
    if (servicos.length === 0) {
        res.status(404).json({ erro: "Serviço não encontrado" });
        return;
    }

    const duracao = servicos[0].duracao_minutos;
    const diaSemana = new Date(data + "T12:00:00").getDay();

    const { rows: horarios } = await pool.query(
        `
    SELECT hora_inicio, hora_fim FROM horarios_trabalho
    WHERE barbeiro_id = $1 AND dia_semana = $2
  `,
        [barbeiro_id, diaSemana],
    );

    if (horarios.length === 0) {
        res.json({ slots: [], mensagem: "Barbeiro não trabalha neste dia" });
        return;
    }

    const { rows: agendamentos } = await pool.query(
        `
    SELECT hora_inicio, hora_fim FROM agendamentos
    WHERE barbeiro_id = $1 AND data = $2 AND status != 'cancelado'
  `,
        [barbeiro_id, data],
    );

    const { rows: bloqueios } = await pool.query(
        `
    SELECT hora_inicio, hora_fim FROM bloqueios
    WHERE barbeiro_id = $1 AND data = $2
  `,
        [barbeiro_id, data],
    );

    const ocupados = [...agendamentos, ...bloqueios];
    const inicio = horaParaMinutos(horarios[0].hora_inicio);
    const fim = horaParaMinutos(horarios[0].hora_fim);
    const slots: string[] = [];

    for (let minuto = inicio; minuto + duracao <= fim; minuto += 30) {
        const slotInicio = minuto;
        const slotFim = minuto + duracao;

        const conflito = ocupados.some((o) => {
            const oInicio = horaParaMinutos(o.hora_inicio);
            const oFim = horaParaMinutos(o.hora_fim);
            return slotInicio < oFim && slotFim > oInicio;
        });

        if (!conflito) slots.push(minutosParaHora(slotInicio));
    }

    res.json({ slots });
}

export async function criarAgendamento(req: Request, res: Response) {
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

    const { rows: servicos } = await pool.query(
        "SELECT duracao_minutos FROM servicos WHERE id = $1",
        [servico_id],
    );
    if (servicos.length === 0) {
        res.status(404).json({ erro: "Serviço não encontrado" });
        return;
    }

    const horaFim = minutosParaHora(
        horaParaMinutos(hora_inicio) + servicos[0].duracao_minutos,
    );

    const { rows: conflito } = await pool.query(
        `
    SELECT id FROM agendamentos
    WHERE barbeiro_id = $1 AND data = $2 AND status != 'cancelado'
    AND hora_inicio < $3 AND hora_fim > $4
  `,
        [barbeiro_id, data, horaFim, hora_inicio],
    );

    if (conflito.length > 0) {
        res.status(409).json({ erro: "Horário não está mais disponível" });
        return;
    }

    const { rows } = await pool.query(
        `
    INSERT INTO agendamentos
    (barbeiro_id, servico_id, cliente_nome, cliente_telefone, data, hora_inicio, hora_fim)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
  `,
        [
            barbeiro_id,
            servico_id,
            cliente_nome,
            cliente_telefone,
            data,
            hora_inicio,
            horaFim,
        ],
    );

    res.status(201).json({
        id: rows[0].id,
        mensagem: "Agendamento criado com sucesso",
        hora_fim: horaFim,
    });
}

export async function listarAgendamentos(req: AuthRequest, res: Response) {
    const { barbeiro_id, data } = req.query as Record<string, string>;

    if (!barbeiro_id || !data) {
        res.status(400).json({ erro: "barbeiro_id e data são obrigatórios" });
        return;
    }

    const { rows } = await pool.query(
        `
    SELECT a.id, a.cliente_nome, a.cliente_telefone, a.data,
           a.hora_inicio, a.hora_fim, a.status,
           s.nome AS servico, s.preco
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    WHERE a.barbeiro_id = $1 AND a.data = $2
    ORDER BY a.hora_inicio
  `,
        [barbeiro_id, data],
    );

    res.json(rows);
}

export async function cancelarAgendamento(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const { rows } = await pool.query(
        "SELECT id, status FROM agendamentos WHERE id = $1",
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Agendamento não encontrado" });
        return;
    }

    if (rows[0].status === "cancelado") {
        res.status(400).json({ erro: "Agendamento já está cancelado" });
        return;
    }

    await pool.query(
        "UPDATE agendamentos SET status = 'cancelado' WHERE id = $1",
        [id],
    );
    res.json({ mensagem: "Agendamento cancelado com sucesso" });
}

export async function concluirAgendamento(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const { rows } = await pool.query(
        "SELECT id, status FROM agendamentos WHERE id = $1",
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Agendamento não encontrado" });
        return;
    }

    if (rows[0].status !== "confirmado") {
        res.status(400).json({
            erro: "Apenas agendamentos confirmados podem ser concluídos",
        });
        return;
    }

    await pool.query(
        "UPDATE agendamentos SET status = 'concluido' WHERE id = $1",
        [id],
    );
    res.json({ mensagem: "Agendamento concluído com sucesso" });
}

export async function deletarAgendamento(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const { rows } = await pool.query(
        "SELECT id FROM agendamentos WHERE id = $1",
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Agendamento não encontrado" });
        return;
    }

    await pool.query("DELETE FROM agendamentos WHERE id = $1", [id]);
    res.json({ mensagem: "Agendamento deletado" });
}

export async function limparAgendamentosAntigos(
    req: AuthRequest,
    res: Response,
) {
    const { ate_data } = req.body;

    if (!ate_data) {
        res.status(400).json({ erro: "ate_data é obrigatório" });
        return;
    }

    const { rowCount } = await pool.query(
        "DELETE FROM agendamentos WHERE data <= $1",
        [ate_data],
    );

    res.json({ mensagem: "Limpeza concluída", removidos: rowCount });
}

export async function resumoPeriodo(req: AuthRequest, res: Response) {
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

    const { rows } = await pool.query(
        `
    SELECT a.id, a.data, a.hora_inicio, a.hora_fim, a.status,
           a.cliente_nome, a.cliente_telefone,
           s.nome AS servico, s.preco
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    WHERE a.barbeiro_id = $1 AND a.data >= $2 AND a.data <= $3
    ORDER BY a.data, a.hora_inicio
  `,
        [barbeiro_id, data_inicio, data_fim],
    );

    const total = rows.length;
    const concluidos = rows.filter((a) => a.status === "concluido").length;
    const cancelados = rows.filter((a) => a.status === "cancelado").length;
    const receita = rows
        .filter((a) => a.status === "concluido")
        .reduce((acc, a) => acc + parseFloat(a.preco), 0);

    res.json({
        agendamentos: rows,
        resumo: { total, concluidos, cancelados, receita },
    });
}

export async function diasComAgendamento(req: AuthRequest, res: Response) {
    const { barbeiro_id, ano, mes } = req.query as Record<string, string>;

    if (!barbeiro_id || !ano || !mes) {
        res.status(400).json({
            erro: "barbeiro_id, ano e mes são obrigatórios",
        });
        return;
    }

    // Primeiro e último dia do mês
    const dataInicio = `${ano}-${mes.padStart(2, "0")}-01`;
    const dataFim = new Date(Number(ano), Number(mes), 0)
        .toISOString()
        .split("T")[0];

    const { rows } = await pool.query(
        `SELECT DISTINCT CAST(SPLIT_PART(data, '-', 3) AS INT) AS dia
         FROM agendamentos
         WHERE barbeiro_id = $1
           AND data >= $2
           AND data <= $3
           AND status != 'cancelado'
         ORDER BY dia`,
        [barbeiro_id, dataInicio, dataFim],
    );

    res.json({ dias: rows.map((r) => r.dia) });
}
