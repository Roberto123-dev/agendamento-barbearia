import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import barbeirosRouter from "./routes/barbeiros";
import servicosRouter from "./routes/servicos";
import agendamentosRouter from "./routes/agendamentos";
import authRouter from "./routes/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/auth", authRouter);
app.use("/barbeiros", barbeirosRouter);
app.use("/servicos", servicosRouter);
app.use("/agendamentos", agendamentosRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

export default app;
