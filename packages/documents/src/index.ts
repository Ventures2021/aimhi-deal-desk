export type DocumentJobStatus =
  "queued" | "processing" | "completed" | "failed" | "quarantined";

export type DocumentJob = {
  id: string;
  workspaceId: string;
  dealId: string;
  storageObjectId: string;
  status: DocumentJobStatus;
};
