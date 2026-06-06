// LOGIN.JS
const API =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://agendamento-barbearia-la36.onrender.com";

// Pega o slug da URL — ex: /pedro-loeb/login → "pedro-loeb"
const slug = window.location.pathname.split("/")[1] || "demo";

// Se já está logado, redireciona para o painel do slug correto
if (localStorage.getItem("token")) {
    window.location.href = `/${slug}/painel`;
}

// Carrega o tema da barbearia na página de login
async function carregarTema() {
    try {
        const res = await fetch(`/api/barbearia/${slug}`);
        if (!res.ok) return;

        const b = await res.json();

        // Atualiza título e header
        document.title = `Login — ${b.nome_fantasia}`;
        const h1 = document.querySelector("header h1");
        if (h1) h1.textContent = `✂️ ${b.nome_fantasia}`;

        // Aplica cores
        const root = document.documentElement;
        root.style.setProperty("--gold", b.cor_primaria);
        root.style.setProperty("--dark2", b.cor_secundaria);
        root.style.setProperty("--black", b.cor_fundo);
    } catch (e) {
        console.error("Erro ao carregar tema:", e);
    }
}

async function fazerLogin() {
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;
    const erro = document.getElementById("erro");
    const btn = document.getElementById("btn-login");

    erro.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Entrando...";

    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
    });

    const dados = await res.json();

    if (!res.ok) {
        erro.textContent = dados.erro;
        erro.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Entrar";
        return;
    }

    localStorage.setItem("token", dados.token);
    localStorage.setItem("barbeiro", JSON.stringify(dados.barbeiro));

    // Redireciona para o painel do slug correto
    window.location.href = `/${slug}/painel`;
}

// Login ao pressionar Enter
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fazerLogin();
});

// Carrega o tema ao abrir a página
carregarTema();
