import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import barbeirosRouter from "./routes/barbeiros";
import servicosRouter from "./routes/servicos";
import agendamentosRouter from "./routes/agendamentos";
import authRouter from "./routes/auth";
import pool from "./database/db";
import bcrypt from "bcrypt";

dotenv.config();

async function seedSeVazio() {
    const { rows } = await pool.query(
        "SELECT COUNT(*) as total FROM barbeiros",
    );

    if (parseInt(rows[0].total) === 0) {
        console.log("🌱 Banco vazio — rodando seed...");
        const senhaHash = await bcrypt.hash("123456", 10);

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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/auth", authRouter);
app.use("/barbeiros", barbeirosRouter);
app.use("/servicos", servicosRouter);
app.use("/agendamentos", agendamentosRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    await seedSeVazio();
});

export default app;
