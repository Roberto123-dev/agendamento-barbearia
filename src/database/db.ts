import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(__dirname, "../../barbearia.db");
const db = new Database(dbPath);

// Ativa chaves estrangeiras
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS barbeiros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    duracao_minutos INTEGER NOT NULL,
    preco REAL NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS horarios_trabalho (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbeiro_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL, -- 0=domingo, 6=sábado
    hora_inicio TEXT NOT NULL,   -- ex: "09:00"
    hora_fim TEXT NOT NULL,      -- ex: "18:00"
    FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id)
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbeiro_id INTEGER NOT NULL,
    servico_id INTEGER NOT NULL,
    cliente_nome TEXT NOT NULL,
    cliente_telefone TEXT NOT NULL,
    data TEXT NOT NULL,          -- ex: "2025-06-10"
    hora_inicio TEXT NOT NULL,   -- ex: "09:00"
    hora_fim TEXT NOT NULL,      -- ex: "09:45"
    status TEXT NOT NULL DEFAULT 'confirmado', -- confirmado | cancelado | concluido
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id),
    FOREIGN KEY (servico_id) REFERENCES servicos(id)
  );

  CREATE TABLE IF NOT EXISTS bloqueios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbeiro_id INTEGER NOT NULL,
    data TEXT NOT NULL,          -- ex: "2025-06-15"
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    motivo TEXT,
    FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id)
  );
`);

export default db;
