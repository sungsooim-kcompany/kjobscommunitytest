import { Router } from "express";
import db from "../db";

const router = Router();

// POST /comments — create comment
router.post("/", (req, res) => {
  const { postId, content } = req.body as {
    postId: string;
    content: string;
  };
  const user = req.session.user!;

  const postIdNum = parseInt(postId, 10);

  if (!content?.trim()) {
    return res.redirect(`/posts/${postIdNum}`);
  }

  const post = db
    .prepare("SELECT id FROM posts WHERE id = ?")
    .get(postIdNum);

  if (!post) return res.redirect("/posts");

  db.prepare(
    "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)"
  ).run(postIdNum, user.id, content.trim());

  res.redirect(`/posts/${postIdNum}`);
});

// POST /comments/:id/delete
router.post("/:id/delete", (req, res) => {
  const commentId = parseInt(req.params["id"]!, 10);
  const user = req.session.user!;

  const comment = db
    .prepare("SELECT id, post_id, user_id FROM comments WHERE id = ?")
    .get(commentId) as
    | { id: number; post_id: number; user_id: number }
    | undefined;

  if (!comment) return res.redirect("/posts");

  const canDelete =
    comment.user_id === user.id ||
    user.role === "admin" ||
    user.role === "master";

  if (!canDelete) return res.redirect(`/posts/${comment.post_id}`);

  db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);

  res.redirect(`/posts/${comment.post_id}`);
});

export default router;
