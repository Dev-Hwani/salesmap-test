"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company, Contact, CustomField, Stage, UserSummary } from "@/types/domain";

type DealFormProps = {
  open: boolean;
  onClose: () => void;
  pipelineId: number | null;
  stages: Stage[];
  fields: CustomField[];
  onCreated: () => void;
};

export function DealForm({
  open,
  onClose,
  pipelineId,
  stages,
  fields,
  onCreated,
}: DealFormProps) {
  const [name, setName] = useState("");
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [assignableUsers, setAssignableUsers] = useState<UserSummary[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companyMode, setCompanyMode] = useState<"existing" | "new">("existing");
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [newCompany, setNewCompany] = useState({ name: "", industry: "", size: "" });
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const [customValues, setCustomValues] = useState<Record<number, string>>({});
  const [customBoolValues, setCustomBoolValues] = useState<Record<number, boolean>>({});
  const [customMultiValues, setCustomMultiValues] = useState<Record<number, number[]>>({});
  const [customUserValues, setCustomUserValues] = useState<Record<number, number[]>>({});
  const [customFiles, setCustomFiles] = useState<Record<number, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visibleInCreate),
    [fields]
  );

  const companyMap = useMemo(() => {
    const map = new Map<number, string>();
    companies.forEach((company) => map.set(company.id, company.name));
    return map;
  }, [companies]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/users/assignable")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) setAssignableUsers(data.users);
      })
      .catch(() => null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    Promise.all([fetch("/api/companies"), fetch("/api/contacts")])
      .then(async ([companiesRes, contactsRes]) => {
        if (companiesRes.ok) {
          const data = await companiesRes.json().catch(() => null);
          setCompanies(data?.companies ?? []);
        }
        if (contactsRes.ok) {
          const data = await contactsRes.json().catch(() => null);
          setContacts(data?.contacts ?? []);
        }
      })
      .catch(() => null);
  }, [open]);

  useEffect(() => {
    if (assignableUsers.length > 0 && !ownerId) {
      setOwnerId(String(assignableUsers[0].id));
    }
  }, [assignableUsers, ownerId]);

  useEffect(() => {
    if (!open || companyMode !== "existing") return;
    if (companies.length > 0 && !companyId) {
      setCompanyId(String(companies[0].id));
    }
  }, [open, companyMode, companies, companyId]);

  useEffect(() => {
    if (!open || contactMode !== "existing") return;
    if (contacts.length > 0 && !contactId) {
      setContactId(String(contacts[0].id));
    }
  }, [open, contactMode, contacts, contactId]);

  useEffect(() => {
    if (!open) return;
    setStageId(stages[0]?.id ? String(stages[0].id) : "");
  }, [open, stages]);

  useEffect(() => {
    if (!open) return;
    setCustomValues({});
    setCustomBoolValues({});
    setCustomMultiValues({});
    setCustomUserValues({});
    setCustomFiles({});
    setCompanyMode("existing");
    setContactMode("existing");
    setCompanyId("");
    setContactId("");
    setNewCompany({ name: "", industry: "", size: "" });
    setNewContact({ name: "", email: "", phone: "" });
    setError(null);
    setWarning(null);
  }, [open]);

  if (!open) return null;

  const updateMultiValue = (fieldId: number, value: number) => {
    setCustomMultiValues((prev) => {
      const list = prev[fieldId] ?? [];
      const exists = list.includes(value);
      const next = exists ? list.filter((id) => id !== value) : [...list, value];
      return { ...prev, [fieldId]: next };
    });
  };

  const updateUserMultiValue = (fieldId: number, value: number) => {
    setCustomUserValues((prev) => {
      const list = prev[fieldId] ?? [];
      const exists = list.includes(value);
      const next = exists ? list.filter((id) => id !== value) : [...list, value];
      return { ...prev, [fieldId]: next };
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pipelineId) return;
    if (!ownerId && assignableUsers.length === 0) {
      setError("담당자 정보를 불러올 수 없습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    setWarning(null);

    const fieldPayload = visibleFields
      .filter((field) => field.type !== "file" && field.type !== "calculation")
      .map((field) => {
        if (field.type === "multi_select") {
          return { fieldId: field.id, value: customMultiValues[field.id] ?? [] };
        }
        if (field.type === "users") {
          return { fieldId: field.id, value: customUserValues[field.id] ?? [] };
        }
        if (field.type === "boolean") {
          const boolValue = customBoolValues[field.id];
          return { fieldId: field.id, value: boolValue ?? null };
        }
        return { fieldId: field.id, value: customValues[field.id] ?? "" };
      });

    const resolvedOwnerId = Number(ownerId || assignableUsers[0]?.id);
    if (!resolvedOwnerId) {
      setError("담당자 정보를 확인해주세요.");
      setLoading(false);
      return;
    }

    let resolvedCompanyId: number | null = null;
    if (companyMode === "existing") {
      resolvedCompanyId = companyId ? Number(companyId) : null;
    } else {
      if (!newCompany.name.trim()) {
        setError("회사명을 입력해주세요.");
        setLoading(false);
        return;
      }
      const companyRes = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompany.name,
          industry: newCompany.industry || null,
          size: newCompany.size || null,
          ownerId: resolvedOwnerId,
        }),
      });
      if (!companyRes.ok) {
        const data = await companyRes.json().catch(() => null);
        setError(data?.error ?? "회사 생성에 실패했습니다.");
        setLoading(false);
        return;
      }
      const data = await companyRes.json().catch(() => null);
      resolvedCompanyId = data?.company?.id ?? null;
      if (!resolvedCompanyId) {
        setError("회사 생성에 실패했습니다.");
        setLoading(false);
        return;
      }
    }

    let resolvedContactId: number | null = null;
    if (contactMode === "existing") {
      resolvedContactId = contactId ? Number(contactId) : null;
      if (!resolvedCompanyId && resolvedContactId) {
        const selectedContact = contacts.find((contact) => contact.id === resolvedContactId);
        if (selectedContact?.companyId) {
          resolvedCompanyId = selectedContact.companyId;
        }
      }
    } else {
      if (!newContact.name.trim()) {
        setError("고객명을 입력해주세요.");
        setLoading(false);
        return;
      }
      const contactRes = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name,
          email: newContact.email || null,
          phone: newContact.phone || null,
          companyId: resolvedCompanyId,
          ownerId: resolvedOwnerId,
        }),
      });
      if (!contactRes.ok) {
        const data = await contactRes.json().catch(() => null);
        setError(data?.error ?? "고객 생성에 실패했습니다.");
        setLoading(false);
        return;
      }
      const data = await contactRes.json().catch(() => null);
      resolvedContactId = data?.contact?.id ?? null;
      if (!resolvedContactId) {
        setError("고객 생성에 실패했습니다.");
        setLoading(false);
        return;
      }
    }

    const payload = {
      name,
      pipelineId,
      stageId: Number(stageId),
      ownerId: resolvedOwnerId,
      companyId: resolvedCompanyId,
      contactId: resolvedContactId,
      expectedRevenue: expectedRevenue ? Number(expectedRevenue) : null,
      closeDate: closeDate || null,
      fieldValues: fieldPayload,
    };

    const hasFiles = Object.values(customFiles).some((files) => files.length > 0);
    const response = await fetch("/api/deals", {
      method: "POST",
      headers: hasFiles ? undefined : { "Content-Type": "application/json" },
      body: hasFiles
        ? (() => {
            const formData = new FormData();
            formData.append("payload", JSON.stringify(payload));
            Object.entries(customFiles).forEach(([fieldId, files]) => {
              files.forEach((file) => formData.append(`file-${fieldId}`, file));
            });
            return formData;
          })()
        : JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "딜 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => null);
    if (data?.warnings?.length) {
      const message = data.warnings.join("\n");
      setWarning(message);
      if (typeof window !== "undefined") {
        window.alert(message);
      }
    }

    setName("");
    setExpectedRevenue("");
    setCloseDate("");
    setCustomValues({});
    setCustomBoolValues({});
    setCustomMultiValues({});
    setCustomUserValues({});
    setCustomFiles({});
    setCompanyMode("existing");
    setContactMode("existing");
    setCompanyId("");
    setContactId("");
    setNewCompany({ name: "", industry: "", size: "" });
    setNewContact({ name: "", email: "", phone: "" });
    setOwnerId("");
    setStageId(stages[0]?.id ? String(stages[0].id) : "");
    setLoading(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-xl rounded bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">딜 생성</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            닫기
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            딜 이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              required
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              예상 매출
              <input
                value={expectedRevenue}
                onChange={(event) => setExpectedRevenue(event.target.value)}
                type="number"
                step="any"
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              마감일
              <input
                value={closeDate}
                onChange={(event) => setCloseDate(event.target.value)}
                type="date"
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              스테이지
              <select
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              담당자
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              >
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded border border-zinc-200 p-3">
            <p className="text-sm font-semibold">회사/고객</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">회사</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="company-mode"
                      checked={companyMode === "existing"}
                      onChange={() => setCompanyMode("existing")}
                    />
                    기존 선택
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="company-mode"
                      checked={companyMode === "new"}
                      onChange={() => setCompanyMode("new")}
                    />
                    신규 생성
                  </label>
                </div>
                {companyMode === "existing" ? (
                  <div className="flex flex-col gap-1">
                    <select
                      value={companyId}
                      onChange={(event) => setCompanyId(event.target.value)}
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="">선택 안 함</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {companies.length === 0 && (
                      <span className="text-xs text-zinc-500">
                        등록된 회사가 없습니다.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      value={newCompany.name}
                      onChange={(event) =>
                        setNewCompany((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="회사명"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={newCompany.industry}
                      onChange={(event) =>
                        setNewCompany((prev) => ({ ...prev, industry: event.target.value }))
                      }
                      placeholder="산업"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={newCompany.size}
                      onChange={(event) =>
                        setNewCompany((prev) => ({ ...prev, size: event.target.value }))
                      }
                      placeholder="규모"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">고객</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="contact-mode"
                      checked={contactMode === "existing"}
                      onChange={() => setContactMode("existing")}
                    />
                    기존 선택
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="contact-mode"
                      checked={contactMode === "new"}
                      onChange={() => setContactMode("new")}
                    />
                    신규 생성
                  </label>
                </div>
                {contactMode === "existing" ? (
                  <div className="flex flex-col gap-1">
                    <select
                      value={contactId}
                      onChange={(event) => setContactId(event.target.value)}
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="">선택 안 함</option>
                      {contacts.map((contact) => {
                        const companyName = contact.companyId
                          ? companyMap.get(contact.companyId) ?? ""
                          : "";
                        return (
                          <option key={contact.id} value={contact.id}>
                            {contact.name}
                            {companyName ? ` (${companyName})` : ""}
                          </option>
                        );
                      })}
                    </select>
                    {contacts.length === 0 && (
                      <span className="text-xs text-zinc-500">
                        등록된 고객이 없습니다.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      value={newContact.name}
                      onChange={(event) =>
                        setNewContact((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="고객명"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={newContact.email}
                      onChange={(event) =>
                        setNewContact((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="이메일"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={newContact.phone}
                      onChange={(event) =>
                        setNewContact((prev) => ({ ...prev, phone: event.target.value }))
                      }
                      placeholder="전화번호"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          {visibleFields.length > 0 && (
            <div className="rounded border border-zinc-200 p-3">
              <p className="text-sm font-semibold">커스텀 필드</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleFields.map((field) => {
                  const labelNode = (
                    <span className="flex items-center gap-2">
                      {field.label}
                      {field.masked && (
                        <span className="text-xs text-zinc-500">마스킹</span>
                      )}
                    </span>
                  );

                  if (field.type === "date") {
                    return (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        {labelNode}
                        <input
                          type="date"
                          value={customValues[field.id] ?? ""}
                          onChange={(event) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.id]: event.target.value,
                            }))
                          }
                          required={field.required}
                          className="rounded border border-zinc-300 px-3 py-2"
                        />
                      </label>
                    );
                  }

                  if (field.type === "datetime") {
                    return (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        {labelNode}
                        <input
                          type="datetime-local"
                          value={customValues[field.id] ?? ""}
                          onChange={(event) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.id]: event.target.value,
                            }))
                          }
                          required={field.required}
                          className="rounded border border-zinc-300 px-3 py-2"
                        />
                      </label>
                    );
                  }

                  if (field.type === "single_select") {
                    return (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        {labelNode}
                        <select
                          value={customValues[field.id] ?? ""}
                          onChange={(event) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.id]: event.target.value,
                            }))
                          }
                          required={field.required}
                          className="rounded border border-zinc-300 px-3 py-2"
                        >
                          <option value="">선택</option>
                          {field.options?.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  if (field.type === "multi_select") {
                    const selected = customMultiValues[field.id] ?? [];
                    return (
                      <div key={field.id} className="flex flex-col gap-2 text-sm">
                        {labelNode}
                        <div className="flex flex-col gap-1 rounded border border-zinc-200 p-2">
                          {field.options?.map((option) => (
                            <label key={option.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected.includes(option.id)}
                                onChange={() => updateMultiValue(field.id, option.id)}
                              />
                              {option.label}
                            </label>
                          ))}
                          {(!field.options || field.options.length === 0) && (
                            <span className="text-xs text-zinc-500">옵션이 없습니다.</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (field.type === "boolean") {
                    return (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        {labelNode}
                        <select
                          value={
                            customBoolValues[field.id] === undefined
                              ? ""
                              : customBoolValues[field.id]
                                ? "true"
                                : "false"
                          }
                          onChange={(event) =>
                            setCustomBoolValues((prev) => ({
                              ...prev,
                              [field.id]: event.target.value === "true",
                            }))
                          }
                          required={field.required}
                          className="rounded border border-zinc-300 px-3 py-2"
                        >
                          <option value="">선택</option>
                          <option value="true">예</option>
                          <option value="false">아니오</option>
                        </select>
                      </label>
                    );
                  }

                  if (field.type === "user") {
                    return (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        {labelNode}
                        <select
                          value={customValues[field.id] ?? ""}
                          onChange={(event) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.id]: event.target.value,
                            }))
                          }
                          required={field.required}
                          className="rounded border border-zinc-300 px-3 py-2"
                        >
                          <option value="">선택</option>
                          {assignableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role})
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  if (field.type === "users") {
                    const selected = customUserValues[field.id] ?? [];
                    return (
                      <div key={field.id} className="flex flex-col gap-2 text-sm">
                        {labelNode}
                        <div className="flex flex-col gap-1 rounded border border-zinc-200 p-2">
                          {assignableUsers.map((user) => (
                            <label key={user.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected.includes(user.id)}
                                onChange={() => updateUserMultiValue(field.id, user.id)}
                              />
                              {user.name} ({user.role})
                            </label>
                          ))}
                          {assignableUsers.length === 0 && (
                            <span className="text-xs text-zinc-500">사용자 정보가 없습니다.</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (field.type === "file") {
                    const files = customFiles[field.id] ?? [];
                    return (
                      <div key={field.id} className="flex flex-col gap-2 text-sm">
                        {labelNode}
                        <input
                          type="file"
                          multiple
                          onChange={(event) => {
                            const list = event.target.files
                              ? Array.from(event.target.files)
                              : [];
                            setCustomFiles((prev) => ({ ...prev, [field.id]: list }));
                          }}
                          className="text-sm"
                        />
                        {files.length > 0 && (
                          <ul className="text-xs text-zinc-600">
                            {files.map((file) => (
                              <li key={file.name}>{file.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  }

                  if (field.type === "calculation") {
                    return (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        {labelNode}
                        <input
                          type="text"
                          value="자동 계산"
                          disabled
                          className="rounded border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-600"
                        />
                      </label>
                    );
                  }

                  return (
                    <label key={field.id} className="flex flex-col gap-1 text-sm">
                      {labelNode}
                      <input
                        type={
                          field.masked && field.type === "text"
                            ? "password"
                            : field.type === "number"
                              ? "number"
                              : "text"
                        }
                        step={field.type === "number" ? "any" : undefined}
                        value={customValues[field.id] ?? ""}
                        onChange={(event) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [field.id]: event.target.value,
                          }))
                        }
                        required={field.required}
                        className="rounded border border-zinc-300 px-3 py-2"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {warning && <p className="text-sm text-amber-600 whitespace-pre-line">{warning}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "생성 중..." : "딜 생성"}
          </button>
        </form>
      </div>
    </div>
  );
}
