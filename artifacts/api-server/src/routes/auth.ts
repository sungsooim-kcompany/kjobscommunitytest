import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db";
import { BASE } from "../config";
import { checkRateLimit, recordFailure, resetAttempts } from "../middleware/rateLimit";

const router = Router();

// GET / → redirect based on login state
router.get("/", (req, res) => {
  if (req.session.user) return res.redirect(`${BASE}/posts`);
  res.redirect(`${BASE}/login`);
});

// GET /login
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect(`${BASE}/posts`);
  res.render("login", {
    error: null,
    username: "",
    registered: req.query["registered"] === "1",
  });
});

// POST /login
router.post("/login", (req, res) => {
  const { username, password } = req.body as {
    username: string;
    password: string;
  };

  if (!username || !password) {
    return res.render("login", {
      error: "아이디와 비밀번호를 입력해 주세요.",
      username: username ?? "",
      registered: false,
    });
  }

  const rateCheck = checkRateLimit(username);
  if (!rateCheck.allowed) {
    const minutesLeft = Math.ceil((rateCheck.waitMs ?? 0) / 60000);
    return res.render("login", {
      error: `로그인 시도가 너무 많습니다. ${minutesLeft}분 후에 다시 시도해 주세요.`,
      username,
      registered: false,
    });
  }

  const user = db
    .prepare(
      "SELECT id, username, password_hash, nickname, role, is_blocked FROM users WHERE username = ?"
    )
    .get(username) as
    | {
        id: number;
        username: string;
        password_hash: string;
        nickname: string;
        role: string;
        is_blocked: number;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFailure(username);
    return res.render("login", {
      error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      username,
      registered: false,
    });
  }

  if (user.is_blocked) {
    return res.render("login", {
      error: "차단된 계정입니다. 관리자에게 문의하세요.",
      username,
      registered: false,
    });
  }

  resetAttempts(username);

  req.session.user = {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role as "user" | "admin" | "master",
  };

  req.session.save(() => {
    res.redirect(`${BASE}/posts`);
  });
});

// GET /register
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect(`${BASE}/posts`);
  res.render("register", { error: null, fields: {} });
});

// POST /register
router.post("/register", (req, res) => {
  const { username, password, passwordConfirm, nickname } = req.body as {
    username: string;
    password: string;
    passwordConfirm: string;
    nickname: string;
  };

  const fields = { username, nickname };

  if (!username || !password || !passwordConfirm || !nickname) {
    return res.render("register", { error: "모든 항목을 입력해 주세요.", fields });
  }

  if (!/^[a-z0-9]{4,20}$/.test(username)) {
    return res.render("register", {
      error: "아이디는 영문 소문자·숫자 4~20자여야 합니다.",
      fields,
    });
  }

  if (password.length < 8) {
    return res.render("register", {
      error: "비밀번호는 8자 이상이어야 합니다.",
      fields,
    });
  }

  if (password !== passwordConfirm) {
    return res.render("register", {
      error: "비밀번호가 일치하지 않습니다.",
      fields,
    });
  }

  if (nickname.length < 2 || nickname.length > 10) {
    return res.render("register", {
      error: "닉네임은 2~10자여야 합니다.",
      fields,
    });
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existingUser) {
    return res.render("register", { error: "이미 사용 중인 아이디입니다.", fields });
  }

  const existingNickname = db.prepare("SELECT id FROM users WHERE nickname = ?").get(nickname);
  if (existingNickname) {
    return res.render("register", { error: "이미 사용 중인 닉네임입니다.", fields });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare(
    "INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)"
  ).run(username, passwordHash, nickname, "user");

  res.redirect(`${BASE}/login?registered=1`);
});

// POST /logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect(`${BASE}/login`);
  });
});

export default router;
