export type UserRole = "A" | "B" | "C";

export type UserSummary = {
  id: number;
  name: string;
  role: UserRole;
};

export type Pipeline = {
  id: number;
  name: string;
  position: number;
  stages: Stage[];
  dealCount?: number;
  stageCount?: number;
};

export type Stage = {
  id: number;
  pipelineId: number;
  name: string;
  probability: number | null;
  description: string | null;
  stagnationDays: number | null;
  position: number;
  dealCount?: number;
};

export type CustomFieldType = "text" | "number" | "date";

export type CustomField = {
  id: number;
  label: string;
  type: CustomFieldType;
  visibleInCreate: boolean;
  visibleInPipeline: boolean;
  position: number;
};

export type DealFieldValue = {
  fieldId: number;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  field?: CustomField;
};

export type Deal = {
  id: number;
  name: string;
  expectedRevenue: number | null;
  closeDate: string | null;
  pipelineId: number;
  stageId: number;
  ownerId: number;
  owner?: UserSummary;
  fieldValues: DealFieldValue[];
};
