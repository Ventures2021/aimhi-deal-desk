export type EvidenceRole = "supporting" | "contradicting";

export type SourceSegment = {
  id: string;
  documentVersionId: string;
  locator: string;
  role: EvidenceRole;
};
