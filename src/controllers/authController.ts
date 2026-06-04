import { Request, Response } from "express";
import db from "../database/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

interface Barbeiro {
    id: number;
    nome: string;
    email: string;
    senha: string;
}

export async function login(req: Request, res: Response) {
    const { email, senha } = req.body;

    if (!email || !senha) {
        res.status(400).json({ erro: "Email e senha são obrigatórios" });
        return;
    }

    const barbeiro = db
        .prepare(
            `
    SELECT id, nome, email, senha
    FROM barbeiros
    WHERE email = ? AND ativo = 1
  `,
        )
        .get(email) as Barbeiro | undefined;

    if (!barbeiro) {
        res.status(401).json({ erro: "Credenciais inválidas" });
        return;
    }

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

    const barbeiro = db
        .prepare(
            `
    SELECT id, senha FROM barbeiros WHERE email = ? AND ativo = 1
  `,
        )
        .get(email) as Barbeiro | undefined;

    if (!barbeiro) {
        res.status(401).json({ erro: "Credenciais inválidas" });
        return;
    }

    const senhaCorreta = await bcrypt.compare(senha_atual, barbeiro.senha);

    if (!senhaCorreta) {
        res.status(401).json({ erro: "Senha atual incorreta" });
        return;
    }

    const novaHash = await bcrypt.hash(nova_senha, 10);

    db.prepare(
        `
    UPDATE barbeiros SET senha = ? WHERE id = ?
  `,
    ).run(novaHash, barbeiro.id);

    res.json({ mensagem: "Senha atualizada com sucesso" });
}
