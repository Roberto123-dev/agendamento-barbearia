import { Request, Response } from "express";
import pool from "../database/db";
import bcrypt from "bcrypt";
import { AuthRequest } from "../middlewares/auth";

export async function listarBarbeiros(req: Request, res: Response) {
    const { rows } = await pool.query(`
    SELECT id, nome, email, ativo, criado_em
    FROM barbeiros WHERE ativo = 1 ORDER BY nome
  `);
    res.json(rows);
}

export async function buscarBarbeiro(req: Request, res: Response) {
    const { id } = req.params;
    const { rows } = await pool.query(
        `
    SELECT id, nome, email, ativo, criado_em
    FROM barbeiros WHERE id = $1 AND ativo = 1
  `,
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Barbeiro não encontrado" });
        return;
    }
    res.json(rows[0]);
}

export async function buscarHorarios(req: Request, res: Response) {
    const { id } = req.params;
    const { rows } = await pool.query(
        `
    SELECT dia_semana, hora_inicio, hora_fim
    FROM horarios_trabalho
    WHERE barbeiro_id = $1 ORDER BY dia_semana
  `,
        [id],
    );
    res.json(rows);
}

export async function cadastrarBarbeiro(req: Request, res: Response) {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
        return;
    }

    const existe = await pool.query(
        "SELECT id FROM barbeiros WHERE email = $1",
        [email],
    );

    if (existe.rows.length > 0) {
        res.status(409).json({ erro: "Email já cadastrado" });
        return;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `
      INSERT INTO barbeiros (nome, email, senha) VALUES ($1, $2, $3) RETURNING id
    `,
            [nome, email, senhaHash],
        );

        const barbeiro_id = rows[0].id;

        for (let dia = 1; dia <= 6; dia++) {
            await client.query(
                `
        INSERT INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim)
        VALUES ($1, $2, $3, $4)
      `,
                [barbeiro_id, dia, "09:00", "18:00"],
            );
        }

        await client.query("COMMIT");
        res.status(201).json({
            id: barbeiro_id,
            mensagem: "Barbeiro cadastrado com sucesso",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function deletarBarbeiro(req: Request, res: Response) {
    const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    );

    if (isNaN(id)) {
        res.status(400).json({ erro: "ID inválido" });
        return;
    }

    const { rows } = await pool.query(
        "SELECT id FROM barbeiros WHERE id = $1 AND ativo = 1",
        [id],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Barbeiro não encontrado" });
        return;
    }

    const hoje = new Date().toISOString().split("T")[0];
    const { rows: agendamentos } = await pool.query(
        `
    SELECT COUNT(*) as total FROM agendamentos
    WHERE barbeiro_id = $1 AND data >= $2 AND status = 'confirmado'
  `,
        [id, hoje],
    );

    if (parseInt(agendamentos[0].total) > 0) {
        res.status(409).json({
            erro: `Barbeiro possui ${agendamentos[0].total} agendamento(s) confirmado(s). Cancele-os antes de deletar.`,
        });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            "DELETE FROM horarios_trabalho WHERE barbeiro_id = $1",
            [id],
        );
        await client.query("DELETE FROM bloqueios WHERE barbeiro_id = $1", [
            id,
        ]);
        await client.query("DELETE FROM agendamentos WHERE barbeiro_id = $1", [
            id,
        ]);
        await client.query("DELETE FROM barbeiros WHERE id = $1", [id]);
        await client.query("COMMIT");
        res.json({ mensagem: "Barbeiro removido com sucesso" });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function salvarHorarios(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { horarios } = req.body;
    // horarios: [{ dia_semana: 1, hora_inicio: "09:00", hora_fim: "18:00" }, ...]

    if (!Array.isArray(horarios)) {
        res.status(400).json({ erro: "horarios deve ser um array" });
        return;
    }

    // Valida cada item
    for (const h of horarios) {
        if (h.dia_semana === undefined || !h.hora_inicio || !h.hora_fim) {
            res.status(400).json({ erro: "Dados inválidos" });
            return;
        }
    }

    // Substitui todos os horários do barbeiro
    await pool.query("DELETE FROM horarios_trabalho WHERE barbeiro_id = $1", [
        id,
    ]);

    for (const h of horarios) {
        await pool.query(
            `INSERT INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim)
             VALUES ($1, $2, $3, $4)`,
            [id, h.dia_semana, h.hora_inicio, h.hora_fim],
        );
    }

    res.json({ mensagem: "Horários salvos com sucesso" });
}
