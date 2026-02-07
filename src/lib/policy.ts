import { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PermissionAction = "read" | "write" | "delete" | "manage";

export function getRolePermissions(role: UserRole) {
  return {
    read: true,
    write: true,
    delete: role !== "C",
    manage: role === "A",
  };
}

export function hasPermission(user: User, action: PermissionAction) {
  return getRolePermissions(user.role)[action];
}

function workspaceFilter(user: User) {
  return user.workspaceId ? { workspaceId: user.workspaceId } : {};
}

function teamFilter(user: User) {
  return user.teamId ? { teamId: user.teamId } : {};
}

export async function getVisibleOwnerIds(user: User) {
  if (user.role === "A") {
    if (!user.workspaceId) return null;
    const users = await prisma.user.findMany({
      where: workspaceFilter(user),
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (user.role === "B") {
    const subordinates = await prisma.user.findMany({
      where: { managerId: user.id, ...workspaceFilter(user), ...teamFilter(user) },
      select: { id: true },
    });
    return [user.id, ...subordinates.map((u) => u.id)];
  }

  return [user.id];
}

export async function getAssignableUsers(user: User) {
  if (user.role === "A") {
    return prisma.user.findMany({
      where: workspaceFilter(user),
      select: { id: true, name: true, role: true },
    });
  }

  if (user.role === "B") {
    return prisma.user.findMany({
      where: {
        OR: [{ id: user.id }, { managerId: user.id }],
        ...workspaceFilter(user),
        ...teamFilter(user),
      },
      select: { id: true, name: true, role: true },
    });
  }

  return prisma.user.findMany({
    where: { id: user.id, ...workspaceFilter(user) },
    select: { id: true, name: true, role: true },
  });
}

export async function canAssignOwner(user: User, ownerId: number) {
  if (user.role === "A") return true;

  if (user.role === "C") {
    return ownerId === user.id;
  }

  if (ownerId === user.id) return true;

  const subordinate = await prisma.user.findFirst({
    where: {
      id: ownerId,
      managerId: user.id,
      role: "C",
      ...workspaceFilter(user),
      ...teamFilter(user),
    },
    select: { id: true },
  });

  return Boolean(subordinate);
}

export async function getManagersForRole(role: UserRole, workspaceId?: number | null) {
  if (role === "B") {
    return prisma.user.findMany({
      where: { role: "A", ...(workspaceId ? { workspaceId } : {}) },
      select: { id: true, name: true, email: true },
    });
  }

  if (role === "C") {
    return prisma.user.findMany({
      where: { role: "B", ...(workspaceId ? { workspaceId } : {}) },
      select: { id: true, name: true, email: true },
    });
  }

  return [];
}

export async function validateManagerForRole(
  role: UserRole,
  managerId?: number | null,
  workspaceId?: number | null
) {
  if (role === "A") {
    return managerId == null;
  }

  if (!managerId) return false;

  const manager = await prisma.user.findFirst({
    where: { id: managerId, ...(workspaceId ? { workspaceId } : {}) },
    select: { role: true },
  });

  if (!manager) return false;

  if (role === "B") return manager.role === "A";
  if (role === "C") return manager.role === "B";

  return false;
}
