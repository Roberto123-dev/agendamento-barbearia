import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import barbeirosRouter from "./routes/barbeiros";
import servicosRouter from "./routes/servicos";
import agendamentosRouter from "./routes/agendamentos";
import authRouter from "./routes/auth";

dotenv.config();

// Roda o seed automaticamente se o banco estiver vazio
import db from "./database/db";
import bcrypt from "bcrypt";

async function seedSeVazio() {
    const total = db
        .prepare("SELECT COUNT(*) as total FROM barbeiros")
        .get() as { total: number };

    if (total.total === 0) {
        console.log("🌱 Banco vazio — rodando seed...");
        const senhaHash = await bcrypt.hash("123456", 10);

        const inserirBarbeiro = db.prepare(
            `INSERT INTO barbeiros (nome, email, senha) VALUES (?, ?, ?)`,
        );
        const r1 = inserirBarbeiro.run(
            "Carlos Silva",
            "carlos@barbearia.com",
            senhaHash,
        );
        const r2 = inserirBarbeiro.run(
            "Roberto Santos",
            "roberto@barbearia.com",
            senhaHash,
        );

        const inserirServico = db.prepare(
            `INSERT INTO servicos (nome, duracao_minutos, preco) VALUES (?, ?, ?)`,
        );
        inserirServico.run("Corte de cabelo", 30, 35.0);
        inserirServico.run("Barba", 20, 25.0);
        inserirServico.run("Corte + Barba", 50, 55.0);
        inserirServico.run("Sobrancelha", 15, 15.0);

        const inserirHorario = db.prepare(
            `INSERT INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)`,
        );
        for (const id of [r1.lastInsertRowid, r2.lastInsertRowid]) {
            for (let dia = 1; dia <= 6; dia++) {
                inserirHorario.run(id, dia, "09:00", "18:00");
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
