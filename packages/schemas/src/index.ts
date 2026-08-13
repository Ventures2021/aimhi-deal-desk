export type DocumentRegisteredEnvelope = {
  schemaVersion: string;
  eventType: "document.registered";
  eventId: string;
  workspaceId: string;
  dealId: string;
  storageObjectId: string;
  jobId: string;
  occurredAt: string;
};

const normalizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
};

export function parseDocumentRegisteredEnvelope(
  value: unknown,
): DocumentRegisteredEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const envelope: DocumentRegisteredEnvelope = {
    schemaVersion: normalizeText(candidate.schemaVersion, 16),
    eventType: normalizeText(candidate.eventType, 64) as "document.registered",
    eventId: normalizeText(candidate.eventId, 64),
    workspaceId: normalizeText(candidate.workspaceId, 64),
    dealId: normalizeText(candidate.dealId, 64),
    storageObjectId: normalizeText(candidate.storageObjectId, 64),
    jobId: normalizeText(candidate.jobId, 64),
    occurredAt: normalizeText(candidate.occurredAt, 40),
  };

  if (
    !envelope.eventId ||
    !envelope.jobId ||
    envelope.eventType !== "document.registered"
  ) {
    return null;
  }

  return envelope;
}
