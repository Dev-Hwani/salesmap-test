import type { CustomFieldType, ObjectType } from "@/types/domain";

export type SystemField = {
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  masked?: boolean;
  visibleInCreate?: boolean;
  visibleInPipeline?: boolean;
};

export const SYSTEM_FIELDS: Record<ObjectType, SystemField[]> = {
  DEAL: [
    { key: "name", label: "딜 이름", type: "text", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "ownerId", label: "담당자", type: "number", required: true, visibleInCreate: true },
    { key: "pipelineId", label: "파이프라인", type: "number", required: true, visibleInCreate: true },
    { key: "stageId", label: "스테이지", type: "number", required: true, visibleInCreate: true },
    { key: "expectedRevenue", label: "예상 매출", type: "number", visibleInCreate: true, visibleInPipeline: true },
    { key: "closeDate", label: "마감일", type: "date", visibleInCreate: true, visibleInPipeline: true },
    { key: "createdAt", label: "생성일", type: "datetime" },
    { key: "updatedAt", label: "수정일", type: "datetime" },
  ],
  LEAD: [
    { key: "name", label: "리드 이름", type: "text", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "email", label: "이메일", type: "text", visibleInCreate: true, visibleInPipeline: true },
    { key: "phone", label: "전화번호", type: "text", visibleInCreate: true },
    { key: "companyId", label: "회사", type: "number", visibleInCreate: true },
    { key: "status", label: "상태", type: "text", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "ownerId", label: "담당자", type: "number", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "createdAt", label: "생성일", type: "datetime" },
    { key: "updatedAt", label: "수정일", type: "datetime" },
  ],
  CONTACT: [
    { key: "name", label: "고객 이름", type: "text", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "email", label: "이메일", type: "text", visibleInCreate: true, visibleInPipeline: true },
    { key: "phone", label: "전화번호", type: "text", visibleInCreate: true },
    { key: "companyId", label: "회사", type: "number", visibleInCreate: true },
    { key: "ownerId", label: "담당자", type: "number", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "createdAt", label: "생성일", type: "datetime" },
    { key: "updatedAt", label: "수정일", type: "datetime" },
  ],
  COMPANY: [
    { key: "name", label: "회사명", type: "text", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "industry", label: "산업", type: "text", visibleInCreate: true, visibleInPipeline: true },
    { key: "size", label: "규모", type: "text", visibleInCreate: true, visibleInPipeline: true },
    { key: "ownerId", label: "담당자", type: "number", required: true, visibleInCreate: true, visibleInPipeline: true },
    { key: "createdAt", label: "생성일", type: "datetime" },
    { key: "updatedAt", label: "수정일", type: "datetime" },
  ],
};

export function getSystemFields(objectType: ObjectType) {
  return SYSTEM_FIELDS[objectType] ?? [];
}
