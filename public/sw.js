self.addEventListener("push", (event) => {
    const dados = event.data?.json() ?? {};

    event.waitUntil(
        self.registration.showNotification(dados.title || "Barbearia", {
            body: dados.body || "",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            data: dados.data,
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/painel.html";
    event.waitUntil(clients.openWindow(url));
});
