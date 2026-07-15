import express, { type Express } from "express";
import session from "express-session";
import path from "path";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import "./db"; // Initialize DB and seed master account
import authRouter from "./routes/auth";
import postsRouter from "./routes/posts";
import commentsRouter from "./routes/comments";
import adminRouter from "./routes/admin";
import { requireLogin } from "./middleware/auth";

const app: Express = express();

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Static files
app.use(express.static(path.join(__dirname, "../public")));

// Logging
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

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "kjobs-dev-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
    },
  })
);

// Inject session user into all views
app.use((req, res, next) => {
  res.locals["user"] = req.session.user ?? null;
  next();
});

// Routes
app.use("/", authRouter);
app.use("/posts", requireLogin, postsRouter);
app.use("/comments", requireLogin, commentsRouter);
app.use("/admin", adminRouter);

// Catch-all: redirect to login (covers non-existent URLs)
app.use((_req, res) => {
  res.redirect("/login");
});

export default app;
