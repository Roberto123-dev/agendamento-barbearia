import { Request, Response } from "express";
import pool from "../database/db";

export async function listarServicos(req: Request, res: Response) {
    const { rows } = await pool.query(`
    SELECT id, nome, duracao_minutos, preco
    FROM servicos WHERE ativo = 1 ORDER BY preco
  `);
    res.json(rows);
}

export async function buscarServico(req: Request, res: Response) {
    const { id } = req.params;
    const { rows } = await pool.query(
        `
    SELECT id, nome, duracao_minutos, preco
    FROM servicos WHERE id = $1 AND ativo = 1
  `,
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Serviço não encontrado" });
        return;
    }
    res.json(rows[0]);
}
