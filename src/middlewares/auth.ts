import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    barbeiro?: {
        id: number;
        nome: string;
        email: string;
        barbearia_id?: number;
    };
}

export function autenticar(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ erro: "Token não fornecido" });
        return;
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
            id: number;
            nome: string;
            email: string;
        };

        req.barbeiro = payload;
        next();
    } catch {
        res.status(401).json({ erro: "Token inválido ou expirado" });
    }
}
