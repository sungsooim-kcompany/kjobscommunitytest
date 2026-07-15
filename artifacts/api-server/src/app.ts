import express, { type Express } from "express";
import session from "express-session";
import path from "path";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { BASE } from "./config";
import "./db";
import authRouter from "./routes/auth";
import postsRouter from "./routes/posts";
import commentsRouter from "./routes/comments";
import adminRouter from "./routes/admin";
import { requireLogin } from "./middleware/auth";

const app: Express = express();

app.set("trust proxy", 1);

// Replit always terminates TLS at the edge — force HTTPS protocol detection
// so express-session sends the Secure cookie flag correctly inside the proxy.
if (process.env["REPL_ID"]) {
  app.use((_req, _res, next) => {
    _req.headers["x-forwarded-proto"] = "https";
    next();
  });
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(`${BASE}`, express.static(path.join(__dirname, "../public")));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "kjobs-dev-secret-key",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "none",
    },
  })
);

// Inject user and base path into all views
app.use((req, res, next) => {
  res.locals["user"] = req.session.user ?? null;
  res.locals["base"] = BASE;
  next();
});

// Routes mounted under BASE
app.use(`${BASE}`, authRouter);
app.use(`${BASE}/posts`, requireLogin, postsRouter);
app.use(`${BASE}/comments`, requireLogin, commentsRouter);
app.use(`${BASE}/admin`, adminRouter);

// Redirect everything else to login
app.use((_req, res) => {
  res.redirect(`${BASE}/login`);
});

export default app;
