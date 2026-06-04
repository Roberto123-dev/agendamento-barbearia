const API =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://agendamento-barbearia-la36.onrender.com";

const token = localStorage.getItem("token");
const barbeiro = JSON.parse(localStorage.getItem("barbeiro") || "null");

if (!token || !barbeiro) {
    window.location.href = "/login.html";
}

const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
};

// Estado do calendário do painel (por dia)
let dataAtual = new Date();
let dataSelecionada = new Date();

// ─── CALENDÁRIO POR DIA ───────────────────────────────

function toggleCalendarioPainel() {
    const cal = document.getElementById("calendario-painel");
    cal.style.display =
        cal.style.display === "none" || !cal.style.display ? "block" : "none";
}

function fecharCalendario() {
    const cal = document.getElementById("calendario-painel");
    if (cal) cal.style.display = "none";
}

function mudarMes(delta) {
    dataAtual = new Date(
        dataAtual.getFullYear(),
        dataAtual.getMonth() + delta,
        1,
    );
    renderCalendario();
}

function renderCalendario() {
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();

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
    document.getElementById("mes-ano").textContent =
        `${nomesMes[mes]} de ${ano}`;

    document.getElementById("cabecalho-semana").innerHTML = [
        "D",
        "S",
        "T",
        "Q",
        "Q",
        "S",
        "S",
    ]
        .map(
            (d) =>
                `<div style="text-align:center;font-size:0.75rem;color:#aaa;padding:4px;">${d}</div>`,
        )
        .join("");

    const container = document.getElementById("dias-calendario");
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
            dataSelecionada &&
            data.toDateString() === dataSelecionada.toDateString();
        const domingo = diaSemana === 0;

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
                ${passado || domingo ? "disabled" : ""}
                onclick="selecionarData(${ano}, ${mes}, ${dia})"
            >${dia}</button>`;
    }
}

function selecionarData(ano, mes, dia) {
    dataSelecionada = new Date(ano, mes, dia);
    const opcoes = { weekday: "short", day: "numeric", month: "short" };
    document.getElementById("data-selecionada-texto").textContent =
        dataSelecionada.toLocaleDateString("pt-BR", opcoes);
    fecharCalendario();
    renderCalendario();
    carregarAgendamentos();
}

function getDataFormatada() {
    const ano = dataSelecionada.getFullYear();
    const mes = String(dataSelecionada.getMonth() + 1).padStart(2, "0");
    const dia = String(dataSelecionada.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Fecha calendário do dia ao clicar fora
document.addEventListener("click", (e) => {
    const cal = document.getElementById("calendario-painel");
    const trigger = document.getElementById("data-trigger");
    if (
        cal &&
        trigger &&
        !cal.contains(e.target) &&
        !trigger.contains(e.target)
    ) {
        fecharCalendario();
    }

    // Fecha calendários do período ao clicar fora
    ["inicio", "fim"].forEach((tipo) => {
        const calP = document.getElementById(`cal-${tipo}`);
        const triggerP = calP?.previousElementSibling;
        if (
            calP &&
            triggerP &&
            !calP.contains(e.target) &&
            !triggerP.contains(e.target)
        ) {
            calP.style.display = "none";
        }
    });
});

// ─── PAINEL ───────────────────────────────────────────

async function init() {
    document.querySelector("header p").textContent =
        `Bem-vindo, ${barbeiro.nome}`;
    document.getElementById("nome-barbeiro").value = barbeiro.nome;

    dataSelecionada = new Date();
    dataAtual = new Date();

    const opcoes = { weekday: "short", day: "numeric", month: "short" };
    document.getElementById("data-selecionada-texto").textContent =
        dataSelecionada.toLocaleDateString("pt-BR", opcoes);

    renderCalendario();
    carregarAgendamentos();
}

async function carregarAgendamentos() {
    const barbeiro_id = barbeiro.id;
    const data = getDataFormatada();
    const lista = document.getElementById("lista");

    if (!lista) return;
    lista.innerHTML = '<p class="vazio">Carregando...</p>';

    const res = await fetch(
        `${API}/agendamentos?barbeiro_id=${barbeiro_id}&data=${data}`,
        { headers },
    );

    if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("barbeiro");
        window.location.href = "/login.html";
        return;
    }

    const agendamentos = await res.json();
    atualizarResumo(agendamentos);

    if (agendamentos.length === 0) {
        lista.innerHTML =
            '<p class="vazio">Nenhum agendamento para este dia</p>';
        return;
    }

    lista.innerHTML = "";
    agendamentos.forEach((a) => lista.appendChild(criarCard(a)));
}

function atualizarResumo(agendamentos) {
    const ativos = agendamentos.filter((a) => a.status !== "cancelado");
    const concluidos = agendamentos.filter((a) => a.status === "concluido");
    const receita = concluidos.reduce((acc, a) => acc + a.preco, 0);

    const elTotal = document.getElementById("total-dia");
    const elConcluidos = document.getElementById("total-concluidos");
    const elReceita = document.getElementById("total-receita");

    if (elTotal) elTotal.textContent = ativos.length;
    if (elConcluidos) elConcluidos.textContent = concluidos.length;
    if (elReceita) elReceita.textContent = `R$${receita.toFixed(0)}`;
}

function criarCard(a) {
    const card = document.createElement("div");
    card.className = `card-agendamento ${a.status}`;

    const telefoneNumeros = a.cliente_telefone.replace(/\D/g, "");
    const whatsappLink = `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(`Olá ${a.cliente_nome}! Passando para confirmar seu agendamento de ${a.servico} hoje às ${a.hora_inicio}. Te esperamos! ✂️`)}`;

    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex:1;">
            ${
                modoSelecao
                    ? `
                <input type="checkbox" id="check-${a.id}"
                    onchange="toggleSelecao(${a.id}, this)"
                    style="width:18px;height:18px;cursor:pointer;accent-color:#c9a84c;flex-shrink:0;">
            `
                    : ""
            }
            <div class="info-agendamento" style="flex:1;">
                <div class="hora">${a.hora_inicio} – ${a.hora_fim}</div>
                <div class="cliente" style="display:flex;align-items:center;gap:10px;">
                    ${a.cliente_nome}
                    <a href="${whatsappLink}" target="_blank" title="Chamar no WhatsApp" style="
                        display:inline-flex;align-items:center;justify-content:center;
                        width:28px;height:28px;background:#25D366;
                        border-radius:50%;text-decoration:none;flex-shrink:0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="white">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                    </a>
                </div>
                <div class="detalhe">${a.servico} · R$ ${a.preco.toFixed(2)} · 📞 ${a.cliente_telefone}</div>
                <span class="badge ${a.status}">${a.status}</span>
            </div>
        </div>
        <div class="acoes">
            ${
                !modoSelecao && a.status === "confirmado"
                    ? `
                <button class="btn-concluir" onclick="atualizarStatus(${a.id}, 'concluido')">✔ Concluir</button>
                <button class="btn-cancelar" onclick="atualizarStatus(${a.id}, 'cancelar')">✕ Cancelar</button>
            `
                    : ""
            }
        </div>`;
    return card;
}

async function atualizarStatus(id, acao) {
    const url =
        acao === "cancelar"
            ? `${API}/agendamentos/${id}/cancelar`
            : `${API}/agendamentos/${id}/concluir`;

    const res = await fetch(url, { method: "PATCH", headers });

    if (res.ok) {
        carregarAgendamentos();
    } else {
        const dados = await res.json();
        alert(dados.erro || "Erro ao atualizar");
    }
}

// ─── SELEÇÃO E LIMPEZA ────────────────────────────────

let modoSelecao = false;
let selecionados = new Set();

function toggleModoSelecao() {
    modoSelecao = !modoSelecao;
    selecionados.clear();

    const btn = document.getElementById("btn-selecao");
    const barra = document.getElementById("barra-selecao");

    if (modoSelecao) {
        btn.textContent = "✕ Cancelar";
        btn.style.borderColor = "#555";
        btn.style.color = "#aaa";
        barra.style.display = "flex";
    } else {
        btn.textContent = "☑ Selecionar";
        btn.style.borderColor = "#c0392b";
        btn.style.color = "#c0392b";
        barra.style.display = "none";
    }

    // Rerenderiza os cards com ou sem checkbox
    carregarAgendamentos();
}

function toggleSelecao(id, checkbox) {
    if (checkbox.checked) {
        selecionados.add(id);
    } else {
        selecionados.delete(id);
    }

    const texto = document.getElementById("texto-selecao");
    texto.textContent = `${selecionados.size} selecionado(s)`;
}

async function limparSelecionados() {
    if (selecionados.size === 0) {
        alert("Selecione ao menos um agendamento");
        return;
    }

    if (!confirm(`Apagar ${selecionados.size} agendamento(s) selecionado(s)?`))
        return;

    const ids = [...selecionados];

    await Promise.all(
        ids.map((id) =>
            fetch(`${API}/agendamentos/${id}`, {
                method: "DELETE",
                headers,
            }),
        ),
    );

    alert(`✅ ${ids.length} agendamento(s) removido(s)`);
    modoSelecao = false;
    selecionados.clear();

    const btn = document.getElementById("btn-selecao");
    btn.textContent = "☑ Selecionar";
    btn.style.borderColor = "#c0392b";
    btn.style.color = "#c0392b";
    document.getElementById("barra-selecao").style.display = "none";

    carregarAgendamentos();
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("barbeiro");
    window.location.href = "/login.html";
}

// ─── MODAL BARBEIROS ──────────────────────────────────

async function abrirModal() {
    document.getElementById("modal-barbeiro").style.display = "flex";
    await carregarBarbeirosModal();
}

function fecharModal() {
    document.getElementById("modal-barbeiro").style.display = "none";
    document.getElementById("novo-nome").value = "";
    document.getElementById("novo-email").value = "";
    document.getElementById("novo-senha").value = "";
    document.getElementById("erro-barbeiro").style.display = "none";
}

async function carregarBarbeirosModal() {
    const lista = document.getElementById("lista-barbeiros-modal");
    const barbeiros = await fetch(`${API}/barbeiros`).then((r) => r.json());

    if (barbeiros.length === 0) {
        lista.innerHTML =
            '<p style="color:#555;font-size:0.9rem;">Nenhum barbeiro cadastrado</p>';
        return;
    }

    lista.innerHTML = barbeiros
        .map(
            (b) => `
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:10px 14px;background:#111;border:1px solid #333;
            border-radius:8px;margin-bottom:8px;">
            <div>
                <div style="font-weight:bold;">${b.nome}</div>
                <div style="color:#aaa;font-size:0.8rem;">${b.email}</div>
            </div>
            ${
                b.id !== barbeiro.id
                    ? `
                <button onclick="deletarBarbeiro(${b.id}, '${b.nome}')" style="
                    background:transparent;border:1px solid #c0392b;color:#c0392b;
                    padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8rem;">
                    Remover
                </button>`
                    : `<span style="color:#555;font-size:0.8rem;">você</span>`
            }
        </div>`,
        )
        .join("");
}

async function deletarBarbeiro(id, nome) {
    if (!confirm(`Remover o barbeiro "${nome}"?`)) return;

    const res = await fetch(`${API}/barbeiros/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });

    const dados = await res.json();

    if (!res.ok) {
        alert(dados.erro);
        return;
    }

    alert(`✅ ${dados.mensagem}`);
    carregarBarbeirosModal();
}

async function salvarBarbeiro() {
    const nome = document.getElementById("novo-nome").value.trim();
    const email = document.getElementById("novo-email").value.trim();
    const senha = document.getElementById("novo-senha").value;
    const erro = document.getElementById("erro-barbeiro");

    erro.style.display = "none";

    if (!nome || !email || !senha) {
        erro.textContent = "Preencha todos os campos";
        erro.style.display = "block";
        return;
    }

    const res = await fetch(`${API}/barbeiros`, {
        method: "POST",
        headers,
        body: JSON.stringify({ nome, email, senha }),
    });

    const dados = await res.json();

    if (!res.ok) {
        erro.textContent = dados.erro;
        erro.style.display = "block";
        return;
    }

    alert(`✅ ${dados.mensagem}`);
    document.getElementById("novo-nome").value = "";
    document.getElementById("novo-email").value = "";
    document.getElementById("novo-senha").value = "";
    carregarBarbeirosModal();
}

// ─── ABAS ─────────────────────────────────────────────

let abaAtiva = "dia";

function trocarAba(aba) {
    abaAtiva = aba;

    document.getElementById("filtro-dia").style.display =
        aba === "dia" ? "block" : "none";
    document.getElementById("filtro-periodo").style.display =
        aba === "periodo" ? "block" : "none";

    document.getElementById("aba-dia").style.borderBottomColor =
        aba === "dia" ? "#c9a84c" : "transparent";
    document.getElementById("aba-dia").style.color =
        aba === "dia" ? "#c9a84c" : "#aaa";
    document.getElementById("aba-periodo").style.borderBottomColor =
        aba === "periodo" ? "#c9a84c" : "transparent";
    document.getElementById("aba-periodo").style.color =
        aba === "periodo" ? "#c9a84c" : "#aaa";

    const resumoDia = document.getElementById("resumo-dia");
    const lista = document.getElementById("lista");

    if (resumoDia) resumoDia.style.display = aba === "dia" ? "grid" : "none";
    if (lista) lista.innerHTML = "";
}

// ─── CALENDÁRIOS DO PERÍODO ───────────────────────────

const estadoPeriodo = {
    inicio: { atual: new Date(), selecionada: null },
    fim: { atual: new Date(), selecionada: null },
};

function toggleCalendario(tipo) {
    const outro = tipo === "inicio" ? "fim" : "inicio";
    document.getElementById(`cal-${outro}`).style.display = "none";
    const cal = document.getElementById(`cal-${tipo}`);
    cal.style.display =
        cal.style.display === "none" || !cal.style.display ? "block" : "none";
    renderCalendarioPeriodo(tipo);
}

function mudarMesPeriodo(tipo, delta) {
    const estado = estadoPeriodo[tipo];
    estado.atual = new Date(
        estado.atual.getFullYear(),
        estado.atual.getMonth() + delta,
        1,
    );
    renderCalendarioPeriodo(tipo);
}

function renderCalendarioPeriodo(tipo) {
    const estado = estadoPeriodo[tipo];
    const ano = estado.atual.getFullYear();
    const mes = estado.atual.getMonth();

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
    document.getElementById(`mes-ano-${tipo}`).textContent =
        `${nomesMes[mes]} de ${ano}`;

    document.getElementById(`cab-${tipo}`).innerHTML = [
        "D",
        "S",
        "T",
        "Q",
        "Q",
        "S",
        "S",
    ]
        .map(
            (d) =>
                `<div style="text-align:center;font-size:0.75rem;color:#aaa;padding:4px;">${d}</div>`,
        )
        .join("");

    const container = document.getElementById(`dias-${tipo}`);
    container.innerHTML = "";

    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDia; i++) container.innerHTML += `<div></div>`;

    for (let dia = 1; dia <= totalDias; dia++) {
        const data = new Date(ano, mes, dia);
        const ehSelecionado =
            estado.selecionada &&
            data.toDateString() === estado.selecionada.toDateString();

        container.innerHTML += `
            <button class="dia-btn ${ehSelecionado ? "selecionado" : ""}"
                onclick="selecionarDataPeriodo('${tipo}', ${ano}, ${mes}, ${dia})"
            >${dia}</button>`;
    }
}

function selecionarDataPeriodo(tipo, ano, mes, dia) {
    estadoPeriodo[tipo].selecionada = new Date(ano, mes, dia);
    const opcoes = { day: "numeric", month: "short", year: "numeric" };
    document.getElementById(`texto-${tipo}`).textContent = estadoPeriodo[
        tipo
    ].selecionada.toLocaleDateString("pt-BR", opcoes);
    document.getElementById(`cal-${tipo}`).style.display = "none";
    renderCalendarioPeriodo(tipo);
}

function formatarDataPeriodo(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

async function buscarPeriodo() {
    const inicio = estadoPeriodo.inicio.selecionada;
    const fim = estadoPeriodo.fim.selecionada;

    if (!inicio || !fim) {
        alert("Selecione as duas datas");
        return;
    }

    if (inicio > fim) {
        alert("A data início deve ser anterior à data fim");
        return;
    }

    const res = await fetch(
        `${API}/agendamentos/periodo?barbeiro_id=${barbeiro.id}&data_inicio=${formatarDataPeriodo(inicio)}&data_fim=${formatarDataPeriodo(fim)}`,
        { headers },
    );

    const dados = await res.json();
    const { resumo, agendamentos } = dados;

    document.getElementById("p-total").textContent = resumo.total;
    document.getElementById("p-concluidos").textContent = resumo.concluidos;
    document.getElementById("p-receita").textContent =
        `R$${resumo.receita.toFixed(2)}`;

    const lista = document.getElementById("lista-periodo");

    if (agendamentos.length === 0) {
        lista.innerHTML = '<p class="vazio">Nenhum agendamento no período</p>';
    } else {
        lista.innerHTML = "";
        agendamentos.forEach((a) => {
            const card = document.createElement("div");
            card.className = `card-agendamento ${a.status}`;
            card.innerHTML = `
                <div class="info-agendamento">
                    <div class="hora">${a.data} · ${a.hora_inicio} – ${a.hora_fim}</div>
                    <div class="cliente">${a.cliente_nome}</div>
                    <div class="detalhe">${a.servico} · R$ ${a.preco.toFixed(2)}</div>
                    <span class="badge ${a.status}">${a.status}</span>
                </div>`;
            lista.appendChild(card);
        });
    }

    document.getElementById("resumo-periodo").style.display = "block";
}

init();
