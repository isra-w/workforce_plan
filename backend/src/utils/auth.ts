/**
 * utils/auth.ts
 *
 * Thin wrappers around bcryptjs and jsonwebtoken used throughout the auth flow:
 *
 * - hashPassword     — bcrypt-hashes a plaintext password with a cost factor of 12.
 * - comparePassword  — verifies a plaintext password against a stored bcrypt hash.
 * - generateToken    — signs a JWT containing the user's id and role; expiry is
 *                      read from JWT_EXPIRES_IN (default "7d").
 * - verifyToken      — validates and decodes a JWT, returning { id, role }.
 * - generateVerificationToken — creates a cryptographically random 32-byte hex
 *                               string used for email-verification links.
 *
 * JWT_SECRET and JWT_EXPIRES_IN are read from environment variables so secrets
 * never live in source code.
 */
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string, role: string): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign({ id: userId, role }, JWT_SECRET, options);
}

export function verifyToken(token: string): { id: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
