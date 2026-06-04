import db from "./db";
import bcrypt from "bcrypt";

async function seed() {
    console.log("🌱 Iniciando seed...");

    // Barbeiros
    const senhaHash = await bcrypt.hash("123456", 10);

    const inserirBarbeiro = db.prepare(`
    INSERT OR IGNORE INTO barbeiros (nome, email, senha)
    VALUES (?, ?, ?)
  `);

    inserirBarbeiro.run("Carlos Silva", "carlos@barbearia.com", senhaHash);
    inserirBarbeiro.run("Rafael Santos", "rafael@barbearia.com", senhaHash);

    console.log("✅ Barbeiros inseridos");

    // Serviços
    const inserirServico = db.prepare(`
    INSERT OR IGNORE INTO servicos (nome, duracao_minutos, preco)
    VALUES (?, ?, ?)
  `);

    inserirServico.run("Corte de cabelo", 30, 35.0);
    inserirServico.run("Barba", 20, 25.0);
    inserirServico.run("Corte + Barba", 50, 55.0);
    inserirServico.run("Sobrancelha", 15, 15.0);

    console.log("✅ Serviços inseridos");

    // Horários de trabalho (segunda a sábado, 9h às 18h)
    const inserirHorario = db.prepare(`
    INSERT OR IGNORE INTO horarios_trabalho (barbeiro_id, dia_semana, hora_inicio, hora_fim)
    VALUES (?, ?, ?, ?)
  `);

    const barbeiros = db.prepare("SELECT id FROM barbeiros").all() as {
        id: number;
    }[];

    for (const barbeiro of barbeiros) {
        for (let dia = 1; dia <= 6; dia++) {
            // 1=segunda, 6=sábado
            inserirHorario.run(barbeiro.id, dia, "09:00", "18:00");
        }
    }

    console.log("✅ Horários de trabalho inseridos");

    // Bloqueio de almoço (12h às 13h) para todos os barbeiros
    const inserirBloqueio = db.prepare(`
    INSERT OR IGNORE INTO bloqueios (barbeiro_id, data, hora_inicio, hora_fim, motivo)
    VALUES (?, ?, ?, ?, ?)
  `);

    // Bloqueia almoço para hoje e os próximos 7 dias
    for (const barbeiro of barbeiros) {
        for (let i = 0; i < 7; i++) {
            const data = new Date();
            data.setDate(data.getDate() + i);
            const dataStr = data.toISOString().split("T")[0];
            inserirBloqueio.run(
                barbeiro.id,
                dataStr,
                "12:00",
                "13:00",
                "Almoço",
            );
        }
    }

    console.log("✅ Bloqueios de almoço inseridos");
    console.log("🎉 Seed concluído!");
}

seed().catch(console.error);
