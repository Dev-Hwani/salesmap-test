export type UserRole = "A" | "B" | "C";
export type ObjectType = "DEAL" | "LEAD" | "CONTACT" | "COMPANY";

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

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "user"
  | "users"
  | "file"
  | "calculation";

export type CustomFieldOption = {
  id: number;
  fieldId: number;
  label: string;
  position: number;
  deletedAt?: string | null;
};

export type CustomField = {
  id: number;
  objectType: ObjectType;
  label: string;
  type: CustomFieldType;
  formula?: string | null;
  required: boolean;
  masked: boolean;
  visibleInCreate: boolean;
  visibleInPipeline: boolean;
  position: number;
  deletedAt?: string | null;
  options?: CustomFieldOption[];
};

export type FieldValue = {
  fieldId: number;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueDateTime?: string | null;
  valueBoolean?: boolean | null;
  valueUserId?: number | null;
  valueOptionId?: number | null;
  valueUser?: UserSummary | null;
  valueOption?: CustomFieldOption | null;
  field?: CustomField;
};

export type FieldOptionValue = {
  fieldId: number;
  optionId: number;
  option?: CustomFieldOption;
};

export type FieldUserValue = {
  fieldId: number;
  userId: number;
  user?: UserSummary;
};

export type FieldFile = {
  id: number;
  fieldId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt?: string;
  objectType?: ObjectType;
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
  fieldValues: FieldValue[];
  optionValues?: FieldOptionValue[];
  userValues?: FieldUserValue[];
  files?: FieldFile[];
};

export type Lead = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: number | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "LOST";
  ownerId: number;
  owner?: UserSummary;
  fieldValues: FieldValue[];
  optionValues?: FieldOptionValue[];
  userValues?: FieldUserValue[];
  files?: FieldFile[];
};

export type Contact = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: number | null;
  ownerId: number;
  owner?: UserSummary;
  fieldValues: FieldValue[];
  optionValues?: FieldOptionValue[];
  userValues?: FieldUserValue[];
  files?: FieldFile[];
};

export type Company = {
  id: number;
  name: string;
  industry: string | null;
  size: string | null;
  ownerId: number;
  owner?: UserSummary;
  fieldValues: FieldValue[];
  optionValues?: FieldOptionValue[];
  userValues?: FieldUserValue[];
  files?: FieldFile[];
};
