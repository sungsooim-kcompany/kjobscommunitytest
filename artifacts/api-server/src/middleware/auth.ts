import type { Request, Response, NextFunction } from "express";
import { BASE } from "../config";

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.redirect(`${BASE}/login`);
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.session.user;
  if (!user || (user.role !== "admin" && user.role !== "master")) {
    return res.redirect(`${BASE}/posts`);
  }
  next();
}

export function requireMaster(req: Request, res: Response, next: NextFunction) {
  const user = req.session.user;
  if (!user || user.role !== "master") {
    return res.redirect(`${BASE}/posts`);
  }
  next();
}
