import { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getVisibleOwnerIds(user: User) {
  if (user.role === "A") {
    return null;
  }

  if (user.role === "B") {
    const subordinates = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    return [user.id, ...subordinates.map((u) => u.id)];
  }

  return [user.id];
}

export async function getAssignableUsers(user: User) {
  if (user.role === "A") {
    return prisma.user.findMany({ select: { id: true, name: true, role: true } });
  }

  if (user.role === "B") {
    return prisma.user.findMany({
      where: {
        OR: [{ id: user.id }, { managerId: user.id }],
      },
      select: { id: true, name: true, role: true },
    });
  }

  return prisma.user.findMany({
    where: { id: user.id },
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
    where: { id: ownerId, managerId: user.id, role: "C" },
    select: { id: true },
  });

  return Boolean(subordinate);
}

export async function getManagersForRole(role: UserRole) {
  if (role === "B") {
    return prisma.user.findMany({
      where: { role: "A" },
      select: { id: true, name: true, email: true },
    });
  }

  if (role === "C") {
    return prisma.user.findMany({
      where: { role: "B" },
      select: { id: true, name: true, email: true },
    });
  }

  return [];
}

export async function validateManagerForRole(role: UserRole, managerId?: number | null) {
  if (role === "A") {
    return managerId == null;
  }

  if (!managerId) return false;

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { role: true },
  });

  if (!manager) return false;

  if (role === "B") return manager.role === "A";
  if (role === "C") return manager.role === "B";

  return false;
}
