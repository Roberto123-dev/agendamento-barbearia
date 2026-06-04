import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
    process.env.DATABASE_URL?.replace("localhost:5432", "localhost:5433") ||
    "postgresql://postgres:postgres@localhost:5433/barbearia";

console.log("Conectando em:", connectionString);

const pool = new Pool({
    connectionString,
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
});

// Cria as tabelas se não existirem
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
  `);

    console.log("✅ Tabelas verificadas/criadas");
}

initDB().catch(console.error);

export default pool;
