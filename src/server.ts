// SERVER.TS
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import barbeirosRouter from "./routes/barbeiros";
import servicosRouter from "./routes/servicos";
import agendamentosRouter from "./routes/agendamentos";
import authRouter from "./routes/auth";
import pool from "./database/db";
import bcrypt from "bcrypt";
import bloqueiosRouter from "./routes/bloqueios";
import pushRouter from "./routes/push";
import webpush from "web-push";

dotenv.config();

async function initDB() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS barbeiros (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS servicos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      duracao_minutos INTEGER NOT NULL,
      preco REAL NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS horarios_trabalho (
      id SERIAL PRIMARY KEY,
      barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id),
      dia_semana INTEGER NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id),
      servico_id INTEGER NOT NULL REFERENCES servicos(id),
      cliente_nome TEXT NOT NULL,
      cliente_telefone TEXT NOT NULL,
      data TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmado',
      criado_em TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS bloqueios (
      id SERIAL PRIMARY KEY,
      barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id),
      data TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL,
      motivo TEXT
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
      endpoint TEXT UNIQUE NOT NULL,
      subscription TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS barbearias (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      nome_fantasia TEXT NOT NULL,
      logo_url TEXT DEFAULT '/assets/images/5.png',
      cor_primaria TEXT DEFAULT '#c9a84c',
      cor_secundaria TEXT DEFAULT '#1a1a1a',
      cor_fundo TEXT DEFAULT '#0a0a0a',
      fonte_titulo TEXT DEFAULT 'Bebas Neue',
      whatsapp TEXT,
      ativo BOOLEAN DEFAULT true,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    );
  `);
    console.log("✅ Tabelas verificadas/criadas");
}

async function seedSeVazio() {
    const { rows } = await pool.query(
        "SELECT COUNT(*) as total FROM barbeiros",
    );

    if (parseInt(rows[0].total) === 0) {
        console.log("🌱 Banco vazio — rodando seed...");
        const senhaHash = await bcrypt.hash("123456", 10);

        await pool.query(
            `INSERT INTO barbearias (slug, nome_fantasia, logo_url, whatsapp)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (slug) DO NOTHING`,
            [
                "demo",
                "Barbershop Premium",
                "/barbearias/demo/logo.png",
                "5521999999999",
            ],
        );

        const r1 = await pool.query(
            "INSERT INTO barbeiros (nome, email, senha) VALUES ($1, $2, $3) RETURNING id",
            ["Carlos Silva", "carlos@barbearia.com", senhaHash],
        );
        const r2 = await pool.query(
            "INSERT INTO barbeiros (nome, email, senha) VALUES ($1, $2, $3) RETURNING id",
            ["Roberto Santos", "roberto@barbearia.com", senhaHash],
        );

        for (const servico of [
            ["Corte de cabelo", 30, 35.0],
            ["Barba", 20, 25.0],
            ["Corte + Barba", 50, 55.0],
            ["Sobrancelha", 15, 15.0],
        ]) {
            await pool.query(
                "INSERT INTO servicos (nome, duracao_minutos, preco) VALUES ($1, $2, $3)",
                servico,
            );
        }

        for (const id of [r1.rows[0].id, r2.rows[0].id]) {
            for (let dia = 1; dia <= 6; dia++) {
                await pool.query(
                    "INSERT INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4)",
                    [id, dia, "09:00", "18:00"],
                );
            }
        }

        console.log("✅ Seed concluído!");
    }
}

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: { origin: "*" },
});
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── ROTAS DE API ─────────────────────────────────────
// Todas as rotas de API ANTES do express.static e das rotas de página

app.use("/auth", authRouter);
app.use("/barbeiros", barbeirosRouter);
app.use("/servicos", servicosRouter);
app.use("/agendamentos", agendamentosRouter);
app.use("/bloqueios", bloqueiosRouter);
app.use("/push", pushRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rota da API para buscar tema da barbearia
app.get("/api/barbearia/:slug", async (req, res) => {
    const { slug } = req.params;

    const { rows } = await pool.query(
        "SELECT * FROM barbearias WHERE slug = $1 AND ativo = true",
        [slug],
    );

    if (rows.length === 0) {
        res.status(404).json({ erro: "Barbearia não encontrada" });
        return;
    }

    res.json(rows[0]);
});

// ── ARQUIVOS ESTÁTICOS ───────────────────────────────
// express.static ANTES das rotas de página
// Isso permite que /app.js, /style.css, /assets/ etc sejam servidos normalmente
app.use(express.static(path.join(__dirname, "../public")));

// ── ROTAS DE PÁGINA POR SLUG ─────────────────────────
// DEPOIS do static — só pega rotas que não são arquivos estáticos

const slugsReservados = [
    "auth",
    "barbeiros",
    "servicos",
    "agendamentos",
    "bloqueios",
    "push",
    "health",
    "api",
    "socket.io",
    "favicon.ico",
];

app.get("/:slug", (req, res) => {
    const { slug } = req.params;

    // Ignora slugs reservados e arquivos com extensão (.html, .js, .css, .png etc)
    if (slugsReservados.includes(slug) || slug.includes(".")) {
        res.status(404).send("Not found");
        return;
    }

    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/:slug/painel", (req, res) => {
    const { slug } = req.params;
    if (slug.includes(".")) {
        res.status(404).send("Not found");
        return;
    }
    res.sendFile(path.join(__dirname, "../public/painel.html"));
});

app.get("/:slug/login", (req, res) => {
    const { slug } = req.params;
    if (slug.includes(".")) {
        res.status(404).send("Not found");
        return;
    }
    res.sendFile(path.join(__dirname, "../public/login.html"));
});

// ── VAPID ────────────────────────────────────────────
webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

httpServer.listen(PORT, async () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    await initDB();
    await seedSeVazio();
});

export default app;
export { webpush };
