import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      nickname: string;
      role: "user" | "admin" | "master";
    };
  }
}
