/**
 * controllers/authController.ts
 *
 * HTTP layer only — validates input, calls the auth service, and maps results
 * to HTTP responses. No Prisma or database logic lives here.
 */
import { Response, NextFunction } from "express";
import { AuthRequest } from "src/middleware/authMiddleware";
import * as authService from "src/services/authService";

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({
        status: "fail",
        message: "Full name, email, and password are required",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        status: "fail",
        message: "Password must be at least 8 characters",
      });
    }

    let result;
    try {
      result = await authService.registerUser({ email, password, full_name, role });
    } catch (err: unknown) {
      if ((err as Error).message === "DUPLICATE_EMAIL") {
        return res.status(400).json({
          status: "fail",
          message: "An account with this email already exists",
        });
      }
      throw err;
    }

    res.status(201).json({
      status: "success",
      message: "Account created. Please verify your email.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email and password",
      });
    }

    let result;
    try {
      result = await authService.loginUser(email, password);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === "INVALID_CREDENTIALS") {
        return res.status(401).json({ status: "fail", message: "Incorrect email or password" });
      }
      if (msg === "ACCOUNT_INACTIVE") {
        return res.status(401).json({ status: "fail", message: "Your account has been deactivated" });
      }
      throw err;
    }

    res.status(200).json({ status: "success", token: result.token, data: { user: result.user } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// verifyEmail
// ---------------------------------------------------------------------------
export const verifyEmail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let result;
    try {
      result = await authService.verifyUserEmail(req.params.token);
    } catch (err: unknown) {
      if ((err as Error).message === "INVALID_TOKEN") {
        return res.status(400).json({
          status: "fail",
          message: "Invalid or expired verification token",
        });
      }
      throw err;
    }

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      token: result.token,
      data: { user: result.user },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// resendVerification
// ---------------------------------------------------------------------------
export const resendVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let result;
    try {
      result = await authService.resendVerificationToken(req.body.email);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === "USER_NOT_FOUND") {
        return res.status(404).json({ status: "fail", message: "No account found with this email" });
      }
      if (msg === "ALREADY_VERIFIED") {
        return res.status(400).json({ status: "fail", message: "Email is already verified" });
      }
      throw err;
    }

    res.status(200).json({
      status: "success",
      message: "Verification email sent",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getMe
// ---------------------------------------------------------------------------
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await authService.getUserById(req.user!.id);
    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// completeProfile
// ---------------------------------------------------------------------------
export const completeProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await authService.updateUserTitle(req.user!.id, req.body.title ?? null);
    res.status(200).json({ status: "success", message: "Profile completed", data: { user } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------
export const listUsers = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const users = await authService.listAllUsers();
    res.status(200).json({ status: "success", data: { users } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// listRolePermissions
// ---------------------------------------------------------------------------
export const listRolePermissions = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const roles = await authService.listAllRolePermissions();
    res.status(200).json({ status: "success", data: { roles } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// updateRolePermissions
// ---------------------------------------------------------------------------
export const updateRolePermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = req.params.role;
    if (!role) {
      return res.status(400).json({ status: "fail", message: "Invalid role" });
    }

    const permissions = authService.normalizePermissions(req.body.permissions);
    const rolePermission = await authService.setRolePermissions(role, permissions);

    res.status(200).json({
      status: "success",
      message: "Role permissions updated",
      data: { rolePermission },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// updateUserPermissions (legacy flat array — kept for backward compat)
// ---------------------------------------------------------------------------
export const updateUserPermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const permissions = authService.normalizePermissions(req.body.permissions);
    const user = await authService.setUserPermissions(req.params.id, permissions);

    res.status(200).json({
      status: "success",
      message: "Permissions updated",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getResourcePermissions — GET /users/:id/resource-permissions
// Returns the full resource × action grid for a specific user
// ---------------------------------------------------------------------------
export const getResourcePermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const grid = await authService.getUserPermissionGrid(req.params.id);
    res.status(200).json({
      status: "success",
      data: {
        permissions: grid,
        resources: authService.RESOURCES,
        actions: authService.ACTIONS,
        levels: authService.PERMISSION_LEVELS,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// setResourcePermissions — PUT /users/:id/resource-permissions
// Replaces the full resource × action grid for a specific user
// ---------------------------------------------------------------------------
export const setResourcePermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { patches } = req.body as { patches: authService.PermissionPatch[] };
    if (!Array.isArray(patches)) {
      return res.status(400).json({ status: "fail", message: "patches array is required" });
    }
    const grid = await authService.setUserPermissionGrid(req.params.id, patches);
    res.status(200).json({ status: "success", data: { permissions: grid } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getAllRoles — GET /roles
// Returns all system and custom roles
// ---------------------------------------------------------------------------
export const getAllRoles = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const roles = await authService.getAllRoles();
    res.status(200).json({ status: "success", data: { roles } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// createRole — POST /roles
// Creates a new custom role (HR_ADMIN only)
// ---------------------------------------------------------------------------
export const createRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, display_name, description } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({
        status: "fail",
        message: "Role name and display name are required",
      });
    }

    // Validate name format (uppercase with underscores only)
    if (!/^[A-Z_]+$/.test(name)) {
      return res.status(400).json({
        status: "fail",
        message: "Role name must be uppercase letters and underscores only",
      });
    }

    try {
      const role = await authService.createCustomRole({
        name,
        display_name,
        description,
      });

      res.status(201).json({
        status: "success",
        message: "Role created successfully",
        data: { role },
      });
    } catch (err: unknown) {
      if ((err as Error).message === "ROLE_EXISTS") {
        return res.status(400).json({
          status: "fail",
          message: "A role with this name already exists",
        });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// deleteRole — DELETE /roles/:name
// Deletes a custom role (HR_ADMIN only, cannot delete system roles)
// ---------------------------------------------------------------------------
export const deleteRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name } = req.params;

    try {
      await authService.deleteCustomRole(name);
      res.status(200).json({
        status: "success",
        message: "Role deleted successfully",
      });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === "ROLE_NOT_FOUND") {
        return res.status(404).json({ status: "fail", message: "Role not found" });
      }
      if (msg === "CANNOT_DELETE_SYSTEM_ROLE") {
        return res.status(400).json({
          status: "fail",
          message: "Cannot delete system roles",
        });
      }
      if (msg === "ROLE_IN_USE") {
        return res.status(400).json({
          status: "fail",
          message: "Cannot delete role that is assigned to users",
        });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};