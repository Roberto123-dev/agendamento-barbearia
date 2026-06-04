import { Request, Response } from "express";
import db from "../database/db";
import bcrypt from "bcrypt";

// Listar todos os barbeiros ativos
export function listarBarbeiros(req: Request, res: Response) {
    const barbeiros = db
        .prepare(
            `
    SELECT id, nome, email, ativo, criado_em
    FROM barbeiros
    WHERE ativo = 1
  `,
        )
        .all();

    res.json(barbeiros);
}

// Buscar barbeiro por ID
export function buscarBarbeiro(req: Request, res: Response) {
    const { id } = req.params;

    const barbeiro = db
        .prepare(
            `
    SELECT id, nome, email, ativo, criado_em
    FROM barbeiros
    WHERE id = ? AND ativo = 1
  `,
        )
        .get(id);

    if (!barbeiro) {
        res.status(404).json({ erro: "Barbeiro não encontrado" });
        return;
    }

    res.json(barbeiro);
}

// Buscar horários de trabalho do barbeiro
export function buscarHorarios(req: Request, res: Response) {
    const { id } = req.params;

    const horarios = db
        .prepare(
            `
    SELECT dia_semana, hora_inicio, hora_fim
    FROM horarios_trabalho
    WHERE barbeiro_id = ?
    ORDER BY dia_semana
  `,
        )
        .all(id);

    res.json(horarios);
}

export async function cadastrarBarbeiro(req: Request, res: Response) {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
        return;
    }

    const existe = db
        .prepare(
            `
    SELECT id FROM barbeiros WHERE email = ?
  `,
        )
        .get(email);

    if (existe) {
        res.status(409).json({ erro: "Email já cadastrado" });
        return;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    // Usa transação para garantir que barbeiro e horários são inseridos juntos
    const inserir = db.transaction(() => {
        const resultado = db
            .prepare(
                `
      INSERT INTO barbeiros (nome, email, senha) VALUES (?, ?, ?)
    `,
            )
            .run(nome, email, senhaHash);

        const barbeiro_id = resultado.lastInsertRowid;

        const inserirHorario = db.prepare(`
      INSERT INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim)
      VALUES (?, ?, ?, ?)
    `);

        // Segunda a sábado, 9h às 18h
        for (let dia = 1; dia <= 6; dia++) {
            inserirHorario.run(barbeiro_id, dia, "09:00", "18:00");
        }

        return barbeiro_id;
    });

    const barbeiro_id = inserir();

    res.status(201).json({
        id: barbeiro_id,
        mensagem: "Barbeiro cadastrado com sucesso",
    });
}

export function deletarBarbeiro(req: Request, res: Response) {
    const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    );

    if (isNaN(id)) {
        res.status(400).json({ erro: "ID inválido" });
        return;
    }

    const barbeiro = db
        .prepare(
            `
    SELECT id FROM barbeiros WHERE id = ? AND ativo = 1
  `,
        )
        .get(id);

    if (!barbeiro) {
        res.status(404).json({ erro: "Barbeiro não encontrado" });
        return;
    }

    const hoje = new Date().toISOString().split("T")[0];

    const { total } = db
        .prepare(
            `
    SELECT COUNT(*) as total FROM agendamentos
    WHERE barbeiro_id = ? AND data >= ? AND status = 'confirmado'
  `,
        )
        .get(id, hoje) as { total: number };

    if (total > 0) {
        res.status(409).json({
            erro: `Barbeiro possui ${total} agendamento(s) confirmado(s). Cancele-os antes de deletar.`,
        });
        return;
    }

    // Transação — remove tudo relacionado ao barbeiro
    const deletar = db.transaction(() => {
        db.prepare(`DELETE FROM horarios_trabalho WHERE barbeiro_id = ?`).run(
            id,
        );
        db.prepare(`DELETE FROM bloqueios WHERE barbeiro_id = ?`).run(id);
        db.prepare(`DELETE FROM agendamentos WHERE barbeiro_id = ?`).run(id);
        db.prepare(`DELETE FROM barbeiros WHERE id = ?`).run(id);
    });

    deletar();

    res.json({ mensagem: "Barbeiro removido com sucesso" });
}
