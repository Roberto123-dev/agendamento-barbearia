import { Request, Response } from "express";
import pool from "../database/db";
import { AuthRequest } from "../middlewares/auth";

export async function salvarSubscription(req: AuthRequest, res: Response) {
    const { subscription } = req.body;
    const barbeiro_id = req.barbeiro?.id;

    if (!subscription || !barbeiro_id) {
        res.status(400).json({ erro: "Dados inválidos" });
        return;
    }

    const endpoint = subscription.endpoint;

    // Upsert — salva ou atualiza se já existe
    await pool.query(
        `INSERT INTO push_subscriptions (barbeiro_id, endpoint, subscription)
         VALUES ($1, $2, $3)
         ON CONFLICT (endpoint) DO UPDATE SET subscription = $3, barbeiro_id = $1`,
        [barbeiro_id, endpoint, JSON.stringify(subscription)],
    );

    res.json({ mensagem: "Subscription salva" });
}

export async function deletarSubscription(req: AuthRequest, res: Response) {
    const { endpoint } = req.body;

    await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [
        endpoint,
    ]);

    res.json({ mensagem: "Subscription removida" });
}
