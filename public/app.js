// APP.JS
const API =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://agendamento-barbearia-la36.onrender.com";

let slotSelecionado = null;
let dataClienteAtual = new Date();
let dataClienteSelecionada = null;
let diasTrabalho = new Set(); // dias da semana (0-6) que o barbeiro trabalha

// ─── CALENDÁRIO CLIENTE ───────────────────────────────

function toggleCalendarioCliente() {
    const cal = document.getElementById("calendario-cliente");
    cal.style.display =
        cal.style.display === "none" || cal.style.display === ""
            ? "block"
            : "none";
}

function fecharCalendarioCliente() {
    document.getElementById("calendario-cliente").style.display = "none";
}

function mudarMesCliente(delta) {
    dataClienteAtual = new Date(
        dataClienteAtual.getFullYear(),
        dataClienteAtual.getMonth() + delta,
        1,
    );
    renderCalendarioCliente();
}

function renderCalendarioCliente() {
    const ano = dataClienteAtual.getFullYear();
    const mes = dataClienteAtual.getMonth();

    const nomesMes = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ];
    document.getElementById("mes-ano-cliente").textContent =
        `${nomesMes[mes]} de ${ano}`;

    // Cabeçalho
    document.getElementById("cabecalho-semana-cliente").innerHTML = [
        "D",
        "S",
        "T",
        "Q",
        "Q",
        "S",
        "S",
    ]
        .map(
            (d) => `
      <div style="text-align:center; font-size:0.75rem; color:#aaa; padding:4px;">${d}</div>
    `,
        )
        .join("");

    const container = document.getElementById("dias-calendario-cliente");
    container.innerHTML = "";

    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (let i = 0; i < primeiroDia; i++) {
        container.innerHTML += `<div></div>`;
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const data = new Date(ano, mes, dia);
        const diaSemana = data.getDay();
        const passado = data < hoje;
        const ehHoje = data.toDateString() === hoje.toDateString();
        const ehSelecionado =
            dataClienteSelecionada &&
            data.toDateString() === dataClienteSelecionada.toDateString();
        const domingo = diaSemana === 0;
        const temDisponibilidade = diasTrabalho.has(diaSemana);
        const desabilitado = passado || domingo || !temDisponibilidade;

        const classes = [
            "dia-btn",
            ehHoje ? "hoje" : "",
            ehSelecionado ? "selecionado" : "",
            domingo ? "domingo" : "",
        ]
            .filter(Boolean)
            .join(" ");

        container.innerHTML += `
        <button class="${classes}"
            ${desabilitado ? "disabled" : ""}
            onclick="selecionarDataCliente(${ano}, ${mes}, ${dia})"
            style="position:relative;"
        >
            ${dia}
            ${
                !passado && !domingo && temDisponibilidade
                    ? `
                <span style="
                    position:absolute;bottom:3px;left:50%;
                    transform:translateX(-50%);
                    width:5px;height:5px;border-radius:50%;
                    background:#4caf50;display:block;
                "></span>`
                    : ""
            }
            ${
                !passado && !domingo && !temDisponibilidade
                    ? `
                <span style="
                    position:absolute;bottom:3px;left:50%;
                    transform:translateX(-50%);
                    width:5px;height:5px;border-radius:50%;
                    background:#c0392b;display:block;
                "></span>`
                    : ""
            }
        </button>`;
    }
}

async function carregarDiasTrabalho() {
    const barbeiro_id = document.getElementById("barbeiro").value;

    if (!barbeiro_id) {
        diasTrabalho = new Set();
        renderCalendarioCliente();
        return;
    }

    try {
        const res = await fetch(`${API}/barbeiros/${barbeiro_id}/horarios`);
        const rows = await res.json();
        diasTrabalho = new Set(rows.map((h) => h.dia_semana));
    } catch {
        diasTrabalho = new Set();
    }

    renderCalendarioCliente();
}

function selecionarDataCliente(ano, mes, dia) {
    dataClienteSelecionada = new Date(ano, mes, dia);

    const opcoes = { weekday: "short", day: "numeric", month: "short" };
    document.getElementById("data-cliente-texto").textContent =
        dataClienteSelecionada.toLocaleDateString("pt-BR", opcoes);

    fecharCalendarioCliente();
    renderCalendarioCliente();

    // Reseta slots
    slotSelecionado = null;
    atualizarBotao();
    carregarSlots();
}

function getDataClienteFormatada() {
    if (!dataClienteSelecionada) return "";
    const ano = dataClienteSelecionada.getFullYear();
    const mes = String(dataClienteSelecionada.getMonth() + 1).padStart(2, "0");
    const dia = String(dataClienteSelecionada.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Fecha ao clicar fora
document.addEventListener("click", (e) => {
    const cal = document.getElementById("calendario-cliente");
    const trigger = document.getElementById("data-trigger");
    if (
        cal &&
        trigger &&
        !cal.contains(e.target) &&
        !trigger.contains(e.target)
    ) {
        fecharCalendarioCliente();
    }
});

// ─── AGENDAMENTO ──────────────────────────────────────

async function init() {
    const [barbeiros, servicos] = await Promise.all([
        fetch(`${API}/barbeiros`).then((r) => r.json()),
        fetch(`${API}/servicos`).then((r) => r.json()),
    ]);

    const selBarbeiro = document.getElementById("barbeiro");
    barbeiros.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = b.nome;
        selBarbeiro.appendChild(opt);
    });

    const selServico = document.getElementById("servico");
    servicos.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.nome} — ${s.duracao_minutos}min — R$ ${s.preco.toFixed(2)}`;
        selServico.appendChild(opt);
    });

    await carregarDiasTrabalho();
    renderCalendarioCliente();

    // Configura botão WhatsApp
    const WHATSAPP_NUMBER = "5521999999999";
    const WHATSAPP_MSG = encodeURIComponent(
        "Olá! Gostaria de agendar um horário.",
    );
    document.getElementById("btn-whatsapp").href =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
}

async function carregarSlots() {
    const barbeiro = document.getElementById("barbeiro").value;
    const servico = document.getElementById("servico").value;
    const data = getDataClienteFormatada();
    const container = document.getElementById("slots");

    slotSelecionado = null;
    atualizarBotao();

    if (!barbeiro || !servico || !data) {
        container.innerHTML =
            '<p class="hint">Selecione barbeiro, serviço e data</p>';
        return;
    }

    container.innerHTML = '<p class="carregando">Buscando horários...</p>';

    const res = await fetch(
        `${API}/agendamentos/slots?barbeiro_id=${barbeiro}&servico_id=${servico}&data=${data}`,
    );
    const { slots, mensagem } = await res.json();

    if (!slots || slots.length === 0) {
        container.innerHTML = `<p class="hint">${mensagem || "Nenhum horário disponível"}</p>`;
        return;
    }

    container.innerHTML = "";
    slots.forEach((slot) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot";
        btn.textContent = slot;
        btn.onclick = () => selecionarSlot(slot, btn);
        container.appendChild(btn);
    });
}

function selecionarSlot(slot, btn) {
    document
        .querySelectorAll(".slot")
        .forEach((s) => s.classList.remove("selecionado"));
    btn.classList.add("selecionado");
    slotSelecionado = slot;
    atualizarBotao();
}

function atualizarBotao() {
    const nome = document.getElementById("cliente-nome").value.trim();
    const tel = document.getElementById("cliente-telefone").value.trim();
    const btn = document.getElementById("btn-agendar");
    btn.disabled = !slotSelecionado || !nome || !tel;
}

document
    .getElementById("form-agendamento")
    .addEventListener("submit", async (e) => {
        e.preventDefault();

        const body = {
            barbeiro_id: parseInt(document.getElementById("barbeiro").value),
            servico_id: parseInt(document.getElementById("servico").value),
            cliente_nome: document.getElementById("cliente-nome").value.trim(),
            cliente_telefone: document
                .getElementById("cliente-telefone")
                .value.trim(),
            data: getDataClienteFormatada(),
            hora_inicio: slotSelecionado,
        };

        const res = await fetch(`${API}/agendamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const dados = await res.json();

        if (!res.ok) {
            alert(dados.erro || "Erro ao agendar");
            return;
        }

        document.getElementById("form-agendamento").classList.add("hidden");
        document.getElementById("confirmacao").classList.remove("hidden");
        document.getElementById("confirmacao-detalhes").innerHTML = `
    <strong>${body.cliente_nome}</strong><br/>
    ${document.getElementById("servico").selectedOptions[0].text.split(" —")[0]}<br/>
    📅 ${document.getElementById("data-cliente-texto").textContent}<br/>
    🕐 ${body.hora_inicio}<br/>
    💈 ${document.getElementById("barbeiro").selectedOptions[0].text}
  `;
    });

function resetarFormulario() {
    document.getElementById("form-agendamento").reset();
    document.getElementById("form-agendamento").classList.remove("hidden");
    document.getElementById("confirmacao").classList.add("hidden");
    document.getElementById("slots").innerHTML =
        '<p class="hint">Selecione barbeiro, serviço e data</p>';
    document.getElementById("data-cliente-texto").textContent =
        "Selecione uma data";
    dataClienteSelecionada = null;
    slotSelecionado = null;
    atualizarBotao();
    renderCalendarioCliente();
}

document.getElementById("barbeiro").addEventListener("change", () => {
    carregarDiasTrabalho(); // atualiza calendário com pontos
    carregarSlots(); // atualiza slots disponíveis
});
document.getElementById("servico").addEventListener("change", carregarSlots);
document
    .getElementById("cliente-nome")
    .addEventListener("input", atualizarBotao);
document
    .getElementById("cliente-telefone")
    .addEventListener("input", atualizarBotao);

init();
