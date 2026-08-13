import { providersConfigured } from "@aimhi/integrations";
import { createRequestContext, logHttpRequest } from "@aimhi/observability";
import { parseDocumentRegisteredEnvelope } from "@aimhi/schemas";

export default {
  async fetch(request: Request): Promise<Response> {
    const context = createRequestContext(request);
    const response = Response.json({
      service: "aimhi-deal-desk-processing-worker",
      status: "ok",
      providersConfigured: providersConfigured(),
    });
    logHttpRequest(request, response, context);
    return response;
  },

  async queue(batch: {
    messages: Array<{ body: unknown; ack: () => void }>;
  }): Promise<void> {
    for (const message of batch.messages) {
      parseDocumentRegisteredEnvelope(message.body);
      message.ack();
    }
  },
};
