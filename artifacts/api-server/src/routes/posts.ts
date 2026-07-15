import { Router } from "express";
import db from "../db";
import { BASE } from "../config";

const router = Router();
const PAGE_SIZE = 20;

// GET /posts
router.get("/", (req, res) => {
  const page = parseInt(String(req.query["page"] ?? "1"), 10) || 1;
  const search = (req.query["search"] as string) ?? "";
  const searchType = (req.query["searchType"] as string) ?? "title";
  const offset = (page - 1) * PAGE_SIZE;

  let query = "";
  let countQuery = "";
  let params: unknown[] = [];

  if (search) {
    if (searchType === "title") {
      query = `SELECT p.id, p.title, u.nickname, p.created_at, p.view_count
               FROM posts p JOIN users u ON p.user_id = u.id
               WHERE p.title LIKE ? ORDER BY p.id DESC LIMIT ? OFFSET ?`;
      countQuery = "SELECT COUNT(*) as cnt FROM posts p WHERE p.title LIKE ?";
      params = [`%${search}%`];
    } else if (searchType === "titleContent") {
      query = `SELECT p.id, p.title, u.nickname, p.created_at, p.view_count
               FROM posts p JOIN users u ON p.user_id = u.id
               WHERE p.title LIKE ? OR p.content LIKE ? ORDER BY p.id DESC LIMIT ? OFFSET ?`;
      countQuery = "SELECT COUNT(*) as cnt FROM posts p WHERE p.title LIKE ? OR p.content LIKE ?";
      params = [`%${search}%`, `%${search}%`];
    } else if (searchType === "nickname") {
      query = `SELECT p.id, p.title, u.nickname, p.created_at, p.view_count
               FROM posts p JOIN users u ON p.user_id = u.id
               WHERE u.nickname LIKE ? ORDER BY p.id DESC LIMIT ? OFFSET ?`;
      countQuery = "SELECT COUNT(*) as cnt FROM posts p JOIN users u ON p.user_id = u.id WHERE u.nickname LIKE ?";
      params = [`%${search}%`];
    }
  } else {
    query = `SELECT p.id, p.title, u.nickname, p.created_at, p.view_count
             FROM posts p JOIN users u ON p.user_id = u.id
             ORDER BY p.id DESC LIMIT ? OFFSET ?`;
    countQuery = "SELECT COUNT(*) as cnt FROM posts";
    params = [];
  }

  const posts = db.prepare(query).all(...params, PAGE_SIZE, offset) as {
    id: number; title: string; nickname: string; created_at: string; view_count: number;
  }[];

  const countResult = db.prepare(countQuery).get(...params) as { cnt: number };
  const total = countResult.cnt;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  res.render("posts/index", { posts, page, totalPages, search, searchType, isSearch: !!search, total });
});

// GET /posts/new
router.get("/new", (req, res) => {
  res.render("posts/new", { error: null });
});

// POST /posts
router.post("/", (req, res) => {
  const { title, content } = req.body as { title: string; content: string };
  const user = req.session.user!;

  if (!title?.trim() || !content?.trim()) {
    return res.render("posts/new", { error: "제목과 본문을 입력해 주세요." });
  }

  const result = db
    .prepare("INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)")
    .run(user.id, title.trim(), content.trim());

  res.redirect(`${BASE}/posts/${result.lastInsertRowid}`);
});

// GET /posts/:id
router.get("/:id", (req, res) => {
  const postId = parseInt(req.params["id"]!, 10);

  const post = db
    .prepare(`SELECT p.id, p.title, p.content, p.view_count, p.created_at, p.updated_at,
                     p.user_id, u.nickname
              FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`)
    .get(postId) as {
      id: number; title: string; content: string; view_count: number;
      created_at: string; updated_at: string; user_id: number; nickname: string;
    } | undefined;

  if (!post) return res.redirect(`${BASE}/posts`);

  db.prepare("UPDATE posts SET view_count = view_count + 1 WHERE id = ?").run(postId);
  post.view_count += 1;

  const comments = db
    .prepare(`SELECT c.id, c.content, c.created_at, c.user_id, u.nickname
              FROM comments c JOIN users u ON c.user_id = u.id
              WHERE c.post_id = ? ORDER BY c.id ASC`)
    .all(postId) as {
      id: number; content: string; created_at: string; user_id: number; nickname: string;
    }[];

  res.render("posts/show", { post, comments });
});

// GET /posts/:id/edit
router.get("/:id/edit", (req, res) => {
  const postId = parseInt(req.params["id"]!, 10);
  const user = req.session.user!;

  const post = db
    .prepare("SELECT id, title, content, user_id FROM posts WHERE id = ?")
    .get(postId) as { id: number; title: string; content: string; user_id: number } | undefined;

  if (!post) return res.redirect(`${BASE}/posts`);
  if (post.user_id !== user.id) return res.redirect(`${BASE}/posts/${postId}`);

  res.render("posts/edit", { post, error: null });
});

// POST /posts/:id/edit
router.post("/:id/edit", (req, res) => {
  const postId = parseInt(req.params["id"]!, 10);
  const user = req.session.user!;
  const { title, content } = req.body as { title: string; content: string };

  const post = db
    .prepare("SELECT id, user_id FROM posts WHERE id = ?")
    .get(postId) as { id: number; user_id: number } | undefined;

  if (!post || post.user_id !== user.id) return res.redirect(`${BASE}/posts`);

  if (!title?.trim() || !content?.trim()) {
    const fullPost = db.prepare("SELECT id, title, content, user_id FROM posts WHERE id = ?").get(postId);
    return res.render("posts/edit", { post: fullPost, error: "제목과 본문을 입력해 주세요." });
  }

  db.prepare("UPDATE posts SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(title.trim(), content.trim(), postId);

  res.redirect(`${BASE}/posts/${postId}`);
});

// POST /posts/:id/delete
router.post("/:id/delete", (req, res) => {
  const postId = parseInt(req.params["id"]!, 10);
  const user = req.session.user!;

  const post = db
    .prepare("SELECT id, user_id FROM posts WHERE id = ?")
    .get(postId) as { id: number; user_id: number } | undefined;

  if (!post) return res.redirect(`${BASE}/posts`);

  const canDelete = post.user_id === user.id || user.role === "admin" || user.role === "master";
  if (!canDelete) return res.redirect(`${BASE}/posts/${postId}`);

  db.prepare("DELETE FROM comments WHERE post_id = ?").run(postId);
  db.prepare("DELETE FROM posts WHERE id = ?").run(postId);

  res.redirect(`${BASE}/posts`);
});

export default router;
