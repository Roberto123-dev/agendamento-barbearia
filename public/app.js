// APP.JS
const API =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://agendamento-barbearia-la36.onrender.com";

let slotSelecionado = null;
let dataClienteAtual = new Date();
let dataClienteSelecionada = null;
let diasTrabalho = new Set(); // dias da semana (0-6) que o barbeiro trabalha
let datasBloqueadas = new Set(); // datas específicas bloqueadas ex: "2026-06-20"

// ─── CALENDÁRIO CLIENTE ───────────────────────────────

// ─── TEMA POR SLUG ────────────────────────────────────
const slug = window.location.pathname.split("/")[1] || "";

async function carregarTema() {
    try {
        const res = await fetch(`/api/barbearia/${slug}`);
        if (!res.ok) {
            window.location.href = "/404.html";
            return;
        }

        const b = await res.json();

        // Logo e nome
        const logoImg = document.querySelector(".logo-wrap img");
        const headerTitle = document.querySelector(".header-title");
        const headerSubtitle = document.querySelector(".header-subtitle");

        if (logoImg) logoImg.src = b.logo_url;
        if (headerTitle) headerTitle.textContent = b.nome_fantasia;
        document.title = b.nome_fantasia;

        // WhatsApp
        if (b.whatsapp) {
            const WHATSAPP_MSG = encodeURIComponent(
                "Olá! Gostaria de agendar um horário.",
            );
            const btnWhats = document.getElementById("btn-whatsapp");
            if (btnWhats)
                btnWhats.href = `https://wa.me/${b.whatsapp}?text=${WHATSAPP_MSG}`;
        }

        // Cores via CSS variables
        const root = document.documentElement;
        root.style.setProperty("--gold", b.cor_primaria);
        root.style.setProperty("--dark2", b.cor_secundaria);
        root.style.setProperty("--black", b.cor_fundo);
    } catch (e) {
        console.error("Erro ao carregar tema:", e);
    }
}

function toggleCalendarioCliente() {
    const cal = document.getElementById("calendario-cliente");
    cal.style.display = cal.style.display === "block" ? "none" : "block";
}

function fecharCalendarioCliente() {
    document.getElementById("calendario-cliente").style.display = "none";
}

async function mudarMesCliente(delta) {
    dataClienteAtual = new Date(
        dataClienteAtual.getFullYear(),
        dataClienteAtual.getMonth() + delta,
        1,
    );
    await carregarDiasTrabalho(); // já chama renderCalendarioCliente internamente
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

        // Formata a data igual ao banco: "2026-06-20"
        const dataStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        const bloqueado = datasBloqueadas.has(dataStr);

        const temDisponibilidade = diasTrabalho.has(diaSemana) && !bloqueado;
        const desabilitado =
            passado || domingo || !temDisponibilidade || bloqueado;

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
        datasBloqueadas = new Set();
        renderCalendarioCliente();
        return;
    }

    const ano = dataClienteAtual.getFullYear();
    const mes = String(dataClienteAtual.getMonth() + 1).padStart(2, "0");

    try {
        const [resHorarios, resBloqueios] = await Promise.all([
            fetch(`${API}/barbeiros/${barbeiro_id}/horarios`),
            fetch(
                `${API}/bloqueios?barbeiro_id=${barbeiro_id}&ano=${ano}&mes=${mes}`,
            ),
        ]);

        const horarios = await resHorarios.json();
        const bloqueios = await resBloqueios.json(); // 👈 só uma vez

        diasTrabalho = new Set(horarios.map((h) => h.dia_semana));
        datasBloqueadas = new Set(
            Array.isArray(bloqueios) ? bloqueios.map((b) => b.data) : [],
        );

        console.log("diasTrabalho:", [...diasTrabalho]);
        console.log("datasBloqueadas:", [...datasBloqueadas]);
    } catch (e) {
        console.error("erro em carregarDiasTrabalho:", e);
        diasTrabalho = new Set();
        datasBloqueadas = new Set();
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
    await carregarTema();

    const [barbeiros, servicos] = await Promise.all([
        fetch(`${API}/barbeiros?slug=${slug}`).then((r) => r.json()),
        fetch(`${API}/servicos?slug=${slug}`).then((r) => r.json()),
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

// Adicione no app.js — substitui o form submit
async function confirmarAgendamento() {
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
}

function resetarFormulario() {
    // Limpa os campos manualmente (não tem form.reset())
    document.getElementById("barbeiro").selectedIndex = 0;
    document.getElementById("servico").selectedIndex = 0;
    document.getElementById("cliente-nome").value = "";
    document.getElementById("cliente-telefone").value = "";
    document.getElementById("slots").innerHTML =
        '<p class="hint">Selecione barbeiro, serviço e data</p>';
    document.getElementById("data-cliente-texto").textContent =
        "Selecione uma data";
    document.getElementById("calendario-cliente").style.display = "none";

    dataClienteSelecionada = null;
    slotSelecionado = null;
    atualizarBotao();
    renderCalendarioCliente();

    document.getElementById("form-agendamento").classList.remove("hidden");
    document.getElementById("confirmacao").classList.add("hidden");
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
