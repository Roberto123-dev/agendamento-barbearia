import { Request, Response } from "express";
import pool from "../database/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function login(req: Request, res: Response) {
    const { email, senha } = req.body;

    if (!email || !senha) {
        res.status(400).json({ erro: "Email e senha são obrigatórios" });
        return;
    }

    const { rows } = await pool.query(
        `
    SELECT id, nome, email, senha FROM barbeiros
    WHERE email = $1 AND ativo = 1
  `,
        [email],
    );

    if (rows.length === 0) {
        res.status(401).json({ erro: "Credenciais inválidas" });
        return;
    }

    const barbeiro = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, barbeiro.senha);

    if (!senhaCorreta) {
        res.status(401).json({ erro: "Credenciais inválidas" });
        return;
    }

    const token = jwt.sign(
        { id: barbeiro.id, nome: barbeiro.nome, email: barbeiro.email },
        process.env.JWT_SECRET!,
        { expiresIn: "8h" },
    );

    res.json({
        token,
        barbeiro: {
            id: barbeiro.id,
            nome: barbeiro.nome,
            email: barbeiro.email,
        },
    });
}

export async function trocarSenha(req: Request, res: Response) {
    const { email, senha_atual, nova_senha } = req.body;

    if (!email || !senha_atual || !nova_senha) {
        res.status(400).json({ erro: "Todos os campos são obrigatórios" });
        return;
    }

    const { rows } = await pool.query(
        `
    SELECT id, senha FROM barbeiros WHERE email = $1 AND ativo = 1
  `,
        [email],
    );

    if (rows.length === 0) {
        res.status(401).json({ erro: "Credenciais inválidas" });
        return;
    }

    const senhaCorreta = await bcrypt.compare(senha_atual, rows[0].senha);

    if (!senhaCorreta) {
        res.status(401).json({ erro: "Senha atual incorreta" });
        return;
    }

    const novaHash = await bcrypt.hash(nova_senha, 10);
    await pool.query("UPDATE barbeiros SET senha = $1 WHERE id = $2", [
        novaHash,
        rows[0].id,
    ]);

    res.json({ mensagem: "Senha atualizada com sucesso" });
}
