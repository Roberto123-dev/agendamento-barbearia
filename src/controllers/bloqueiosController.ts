import { Request, Response } from "express";
import pool from "../database/db";
import { AuthRequest } from "../middlewares/auth";

export async function listarBloqueios(req: AuthRequest, res: Response) {
    const { barbeiro_id, ano, mes } = req.query as Record<string, string>;

    if (!barbeiro_id || !ano || !mes) {
        res.status(400).json({
            erro: "barbeiro_id, ano e mes são obrigatórios",
        });
        return;
    }

    const dataInicio = `${ano}-${mes.padStart(2, "0")}-01`;
    const dataFim = new Date(Number(ano), Number(mes), 0)
        .toISOString()
        .split("T")[0];

    const { rows } = await pool.query(
        `SELECT id, data FROM bloqueios
         WHERE barbeiro_id = $1
           AND data >= $2
           AND data <= $3
           AND hora_inicio = '00:00'
           AND hora_fim = '23:59'
         ORDER BY data`,
        [barbeiro_id, dataInicio, dataFim],
    );

    res.json(rows);
}

export async function criarBloqueio(req: AuthRequest, res: Response) {
    const { barbeiro_id, data } = req.body;

    if (!barbeiro_id || !data) {
        res.status(400).json({ erro: "barbeiro_id e data são obrigatórios" });
        return;
    }

    // Verifica se já existe bloqueio nessa data
    const { rows: existe } = await pool.query(
        `SELECT id FROM bloqueios
         WHERE barbeiro_id = $1 AND data = $2
           AND hora_inicio = '00:00' AND hora_fim = '23:59'`,
        [barbeiro_id, data],
    );

    if (existe.length > 0) {
        res.status(409).json({ erro: "Já existe uma folga nesta data" });
        return;
    }

    const { rows } = await pool.query(
        `INSERT INTO bloqueios (barbeiro_id, data, hora_inicio, hora_fim, motivo)
         VALUES ($1, $2, '00:00', '23:59', 'folga')
         RETURNING id`,
        [barbeiro_id, data],
    );

    res.status(201).json({
        id: rows[0].id,
        mensagem: "Folga cadastrada com sucesso",
    });
}

export async function deletarBloqueio(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const { rows } = await pool.query(
        "SELECT id FROM bloqueios WHERE id = $1",
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Bloqueio não encontrado" });
        return;
    }

    await pool.query("DELETE FROM bloqueios WHERE id = $1", [id]);
    res.json({ mensagem: "Folga removida com sucesso" });
}
