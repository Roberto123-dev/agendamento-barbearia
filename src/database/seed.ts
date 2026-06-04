import pool from "./db";
import bcrypt from "bcrypt";

async function seed() {
    console.log("🌱 Iniciando seed...");

    const senhaHash = await bcrypt.hash("123456", 10);

    const r1 = await pool.query(
        "INSERT INTO barbeiros (nome, email, senha) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id",
        ["Carlos Silva", "carlos@barbearia.com", senhaHash],
    );

    const r2 = await pool.query(
        "INSERT INTO barbeiros (nome, email, senha) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id",
        ["Rafael Santos", "rafael@barbearia.com", senhaHash],
    );

    console.log("✅ Barbeiros inseridos");

    await pool.query(
        `INSERT INTO servicos (nome, duracao_minutos, preco) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        ["Corte de cabelo", 30, 35.0],
    );
    await pool.query(
        `INSERT INTO servicos (nome, duracao_minutos, preco) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        ["Barba", 20, 25.0],
    );
    await pool.query(
        `INSERT INTO servicos (nome, duracao_minutos, preco) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        ["Corte + Barba", 50, 55.0],
    );
    await pool.query(
        `INSERT INTO servicos (nome, duracao_minutos, preco) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        ["Sobrancelha", 15, 15.0],
    );

    console.log("✅ Serviços inseridos");

    for (const row of [...r1.rows, ...r2.rows]) {
        for (let dia = 1; dia <= 6; dia++) {
            await pool.query(
                "INSERT INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4)",
                [row.id, dia, "09:00", "18:00"],
            );
        }
    }

    console.log("✅ Horários inseridos");
    console.log("🎉 Seed concluído!");

    await pool.end();
}

seed().catch(console.error);
