/**
 * utils/prisma.ts
 *
 * Exports a single shared PrismaClient instance so every module in the app
 * reuses the same database connection pool instead of opening a new one.
 */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
