
import type { Request, Response, NextFunction } from "express";
import type { Session } from "express-session";

type AuthenticatedUser = {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
};

type AuthSession = Session & {
  user?: AuthenticatedUser;
};

export type AuthenticatedRequest = Request & {
  authUser: AuthenticatedUser;
};

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = req.session as AuthSession;
  const user = session.user;

  if (!user?.googleId || !user.email) {
    res.status(401).json({
      error: "Authentication required. Please sign in with Google.",
    });
    return;
  }

  (req as AuthenticatedRequest).authUser = user;
  next();
}
