import { Router } from "express";
import db from "../db";
import { BASE } from "../config";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAdmin);

// GET /admin/users
router.get("/users", (req, res) => {
  const users = db
    .prepare(`SELECT u.id, u.username, u.nickname, u.role, u.is_blocked, u.created_at,
                     (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) as post_count
              FROM users u ORDER BY u.created_at ASC`)
    .all() as {
      id: number; username: string; nickname: string; role: string;
      is_blocked: number; created_at: string; post_count: number;
    }[];

  res.render("admin/users", { users });
});

// POST /admin/users/:id/block
router.post("/users/:id/block", (req, res) => {
  const targetId = parseInt(req.params["id"]!, 10);
  const actor = req.session.user!;

  const target = db
    .prepare("SELECT id, role, is_blocked FROM users WHERE id = ?")
    .get(targetId) as { id: number; role: string; is_blocked: number } | undefined;

  if (!target) return res.redirect(`${BASE}/admin/users`);
  if (target.id === actor.id) return res.redirect(`${BASE}/admin/users`);
  if (actor.role === "admin" && (target.role === "admin" || target.role === "master")) {
    return res.redirect(`${BASE}/admin/users`);
  }
  if (target.role === "master") return res.redirect(`${BASE}/admin/users`);

  db.prepare("UPDATE users SET is_blocked = ? WHERE id = ?").run(
    target.is_blocked ? 0 : 1,
    targetId
  );

  res.redirect(`${BASE}/admin/users`);
});

// POST /admin/users/:id/role
router.post("/users/:id/role", (req, res) => {
  const actor = req.session.user!;
  if (actor.role !== "master") return res.redirect(`${BASE}/admin/users`);

  const targetId = parseInt(req.params["id"]!, 10);
  const target = db
    .prepare("SELECT id, role FROM users WHERE id = ?")
    .get(targetId) as { id: number; role: string } | undefined;

  if (!target || target.role === "master") return res.redirect(`${BASE}/admin/users`);

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(
    target.role === "admin" ? "user" : "admin",
    targetId
  );

  res.redirect(`${BASE}/admin/users`);
});

export default router;
