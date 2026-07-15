import type { Request, Response, NextFunction } from "express";
import db from "../db";
import { BASE } from "../config";

// Re-validate the logged-in user against the DB on every request so blocking
// takes effect immediately and role/nickname changes apply without re-login.
// Blocked or deleted accounts lose their session on the spot; everyone else
// gets their session copy refreshed to the current DB state.
export function refreshSessionUser(req: Request, res: Response, next: NextFunction) {
  const sessionUser = req.session.user;
  if (!sessionUser) return next();

  const row = db
    .prepare("SELECT nickname, role, is_blocked FROM users WHERE id = ?")
    .get(sessionUser.id) as
    | { nickname: string; role: string; is_blocked: number }
    | undefined;

  if (!row || row.is_blocked) {
    return req.session.destroy(() => {
      res.redirect(`${BASE}/login`);
    });
  }

  sessionUser.nickname = row.nickname;
  sessionUser.role = row.role as "user" | "admin" | "master";
  next();
}
