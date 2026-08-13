import { createRequestContext, logHttpRequest } from "@aimhi/observability";

export default {
  async fetch(request: Request): Promise<Response> {
    const context = createRequestContext(request);
    const response = Response.json({
      service: "aimhi-deal-desk-workflow-worker",
      status: "ok",
      workflows: "scaffolded",
    });
    logHttpRequest(request, response, context);
    return response;
  },
};
