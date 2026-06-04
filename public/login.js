const API = "https://agendamento-barbearia-la36.onrender.com/";

// Se já está logado, redireciona
if (localStorage.getItem("token")) {
    window.location.href = "/painel.html";
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
    window.location.href = "/painel.html";
}

// Login ao pressionar Enter
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fazerLogin();
});
