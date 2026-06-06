// SERVER.TS
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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

// ── SLUGS RESERVADOS ─────────────────────────────────
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

// ── HELPER: injeta Open Graph meta tags no HTML ──────
// Permite preview rico no WhatsApp, Telegram, etc.
function injetarMetaTags(
    html: string,
    b: any,
    slug: string,
    baseUrl: string,
): string {
    const metaTags = `
    <meta property="og:title" content="${b.nome_fantasia}" />
    <meta property="og:description" content="Agende seu horário na ${b.nome_fantasia}. Rápido e fácil!" />
    <meta property="og:image" content="${baseUrl}${b.logo_url}" />
    <meta property="og:url" content="${baseUrl}/${slug}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${b.nome_fantasia}" />
    <meta name="twitter:description" content="Agende seu horário na ${b.nome_fantasia}." />
    <meta name="twitter:image" content="${baseUrl}${b.logo_url}" />`;
    return html.replace("</head>", `${metaTags}\n</head>`);
}

// ── CRIAÇÃO DAS TABELAS ──────────────────────────────
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
      logo_url TEXT DEFAULT '/assets/images/logo.png',
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

// ── SEED INICIAL ─────────────────────────────────────
// Roda apenas se o banco estiver vazio — útil em desenvolvimento
async function seedSeVazio() {
    const { rows } = await pool.query(
        "SELECT COUNT(*) as total FROM barbeiros",
    );

    if (parseInt(rows[0].total) === 0) {
        console.log("🌱 Banco vazio — rodando seed...");
        const senhaHash = await bcrypt.hash("123456", 10);

        const { rows: barbearia } = await pool.query(
            `INSERT INTO barbearias (slug, nome_fantasia, logo_url, whatsapp)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
                "dev",
                "Barbearia Dev",
                "/assets/images/logo.png",
                "5521999999999",
            ],
        );

        const barbearia_id = barbearia[0].id;

        const r1 = await pool.query(
            "INSERT INTO barbeiros (nome, email, senha, barbearia_id) VALUES ($1, $2, $3, $4) RETURNING id",
            ["Carlos Silva", "carlos@barbearia.com", senhaHash, barbearia_id],
        );
        const r2 = await pool.query(
            "INSERT INTO barbeiros (nome, email, senha, barbearia_id) VALUES ($1, $2, $3, $4) RETURNING id",
            [
                "Roberto Santos",
                "roberto@barbearia.com",
                senhaHash,
                barbearia_id,
            ],
        );

        for (const servico of [
            ["Corte de cabelo", 30, 35.0],
            ["Barba", 20, 25.0],
            ["Corte + Barba", 50, 55.0],
            ["Sobrancelha", 15, 15.0],
        ]) {
            await pool.query(
                "INSERT INTO servicos (nome, duracao_minutos, preco, barbearia_id) VALUES ($1, $2, $3, $4)",
                [...servico, barbearia_id],
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

        console.log("✅ Seed concluído! Acesse: /dev");
    }
}

// ── CONFIGURAÇÃO DO SERVIDOR ─────────────────────────
const app = express();
const httpServer = createServer(app);

// Socket.io — comunicação em tempo real com o painel do barbeiro
export const io = new Server(httpServer, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── ROTAS DE API ─────────────────────────────────────

// Autenticação — login do barbeiro
app.use("/auth", authRouter);

// CRUD de barbeiros, horários e busca de horários disponíveis
app.use("/barbeiros", barbeirosRouter);

// CRUD de serviços
app.use("/servicos", servicosRouter);

// Agendamentos — slots, criar, listar, concluir, cancelar, deletar, período
app.use("/agendamentos", agendamentosRouter);

// Bloqueios — folgas pontuais do barbeiro
app.use("/bloqueios", bloqueiosRouter);

// Push notifications — salvar/deletar subscription do navegador
app.use("/push", pushRouter);

// Health check — verifica se o servidor está rodando
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API pública — retorna tema/dados da barbearia pelo slug
// Usada pelo frontend para carregar logo, cores e nome dinamicamente
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
// Serve arquivos da pasta public/ — JS, CSS, imagens, logos
// Deve vir ANTES das rotas de página
app.use(express.static(path.join(__dirname, "../public")));

// ── ROTAS DE PÁGINA POR SLUG ─────────────────────────

// Página de agendamento do cliente — ex: /pedro-loeb
app.get("/:slug", async (req, res) => {
    const { slug } = req.params;

    if (slugsReservados.includes(slug) || slug.includes(".")) {
        res.status(404).send("Not found");
        return;
    }

    // 👇 SELECT * para ter todos os campos incluindo nome_fantasia e logo_url
    const { rows } = await pool.query(
        "SELECT * FROM barbearias WHERE slug = $1 AND ativo = true",
        [slug],
    );

    if (rows.length === 0) {
        res.status(404).send("Barbearia não encontrada");
        return;
    }

    const b = rows[0];
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    const indexPath = path.join(__dirname, "../public/index.html");
    let html = fs.readFileSync(indexPath, "utf-8");

    res.send(injetarMetaTags(html, b, slug, baseUrl));
});

// Painel do barbeiro — ex: /pedro-loeb/painel
app.get("/:slug/painel", async (req, res) => {
    const { slug } = req.params;
    if (slug.includes(".")) {
        res.status(404).send("Not found");
        return;
    }

    // 👇 SELECT * para ter todos os campos
    const { rows } = await pool.query(
        "SELECT * FROM barbearias WHERE slug = $1 AND ativo = true",
        [slug],
    );

    if (rows.length === 0) {
        res.status(404).send("Barbearia não encontrada");
        return;
    }

    const b = rows[0];
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    const painelPath = path.join(__dirname, "../public/painel.html");
    let html = fs.readFileSync(painelPath, "utf-8");

    res.send(injetarMetaTags(html, b, slug, baseUrl));
});

// Login do barbeiro — ex: /pedro-loeb/login
app.get("/:slug/login", async (req, res) => {
    const { slug } = req.params;
    if (slug.includes(".")) {
        res.status(404).send("Not found");
        return;
    }

    // 👇 SELECT * para ter todos os campos
    const { rows } = await pool.query(
        "SELECT * FROM barbearias WHERE slug = $1 AND ativo = true",
        [slug],
    );

    if (rows.length === 0) {
        res.status(404).send("Barbearia não encontrada");
        return;
    }

    const b = rows[0];
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    const loginPath = path.join(__dirname, "../public/login.html");
    let html = fs.readFileSync(loginPath, "utf-8");

    res.send(injetarMetaTags(html, b, slug, baseUrl));
});

// ── VAPID — Push Notifications ───────────────────────
webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

// ── INICIALIZAÇÃO ────────────────────────────────────
httpServer.listen(PORT, async () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    await initDB();
    await seedSeVazio();
});

export default app;
export { webpush };
