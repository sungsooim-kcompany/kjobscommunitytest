import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Session-stored CSRF token. Every view gets it as `csrfToken`; every POST
// form must submit it back as a hidden `_csrf` field.
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals["csrfToken"] = req.session.csrfToken;

  if (req.method === "POST") {
    const submitted = (req.body as Record<string, unknown> | undefined)?.["_csrf"];
    if (typeof submitted !== "string" || !tokensMatch(submitted, req.session.csrfToken)) {
      return res
        .status(403)
        .send("잘못된 요청입니다 (보안 토큰 불일치). 이전 페이지로 돌아가 새로고침 후 다시 시도해 주세요.");
    }
  }

  next();
}
