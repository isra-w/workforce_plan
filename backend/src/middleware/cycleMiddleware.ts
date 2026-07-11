/**
 * middleware/cycleMiddleware.ts
 *
 * checkActiveCycle — Express middleware that looks up the currently active
 * planning cycle in the database. If no active cycle exists it short-circuits
 * the request with a 400 response so planners cannot submit plans outside of
 * an open cycle window. When a cycle is found it is attached to the request
 * object as `req.activeCycle` for downstream handlers to use.
 */
import { Request, Response, NextFunction } from "express";
import { prisma } from "src/utils/prisma";

export const checkActiveCycle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const activeCycle = await prisma.planningCycle.findFirst({
    where: { is_active: true },
  });

  if (!activeCycle) {
    return res.status(400).json({
      status: "fail",
      message: "No active planning cycle. Submissions are currently closed.",
    });
  }

  (req as Request & { activeCycle: typeof activeCycle }).activeCycle =
    activeCycle;
  next();
};
