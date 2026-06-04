import { Router } from "express";
import { login, trocarSenha } from "../controllers/authController";

const router = Router();

router.post("/login", login);
router.post("/trocar-senha", trocarSenha);

export default router;
