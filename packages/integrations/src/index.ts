export type MalwareScanResult =
  | { status: "clean" }
  | { status: "quarantined"; reason: string }
  | { status: "failed"; reason: string };

export type MalwareScanner = {
  scan: (params: {
    objectKey: string;
    mediaType: string;
  }) => Promise<MalwareScanResult>;
};

export type OcrParser = {
  parse: (params: {
    objectKey: string;
    mediaType: string;
  }) => Promise<{ text: string }>;
};

export type ExtractionProvider = {
  extractFacts: (params: {
    text: string;
  }) => Promise<{ facts: Array<Record<string, unknown>> }>;
};

export function providersConfigured(): false {
  return false;
}
