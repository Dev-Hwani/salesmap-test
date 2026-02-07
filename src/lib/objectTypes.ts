import type { ObjectType } from "@/types/domain";

export const OBJECT_TYPES: ObjectType[] = ["DEAL", "LEAD", "CONTACT", "COMPANY"];

export function parseObjectType(value: string | null): ObjectType | null {
  if (!value) return null;
  return OBJECT_TYPES.includes(value as ObjectType)
    ? (value as ObjectType)
    : null;
}

export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  DEAL: "딜",
  LEAD: "리드",
  CONTACT: "고객",
  COMPANY: "회사",
};
