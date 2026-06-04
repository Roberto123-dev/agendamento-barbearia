import { Request, Response } from "express";
import db from "../database/db";

// Listar todos os serviços ativos
export function listarServicos(req: Request, res: Response) {
    const servicos = db
        .prepare(
            `
    SELECT id, nome, duracao_minutos, preco
    FROM servicos
    WHERE ativo = 1
    ORDER BY preco
  `,
        )
        .all();

    res.json(servicos);
}

// Buscar serviço por ID
export function buscarServico(req: Request, res: Response) {
    const { id } = req.params;

    const servico = db
        .prepare(
            `
    SELECT id, nome, duracao_minutos, preco
    FROM servicos
    WHERE id = ? AND ativo = 1
  `,
        )
        .get(id);

    if (!servico) {
        res.status(404).json({ erro: "Serviço não encontrado" });
        return;
    }

    res.json(servico);
}
