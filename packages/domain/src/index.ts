export type WorkspaceId = string;
export type DealId = string;

export type Deal = {
  id: DealId;
  workspaceId: WorkspaceId;
  name: string;
  stage:
    "intake" | "evidence" | "underwriting" | "review" | "decision" | "closed";
};

export type Document = {
  id: string;
  workspaceId: WorkspaceId;
  dealId: DealId;
  documentType: string;
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  predecessorId?: string;
  reviewStatus:
    "unreviewed" | "in_review" | "accepted" | "rejected" | "superseded";
};
