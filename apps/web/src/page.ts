import pageTemplate from "../public/index.html";
import portalSvg from "../public/aimhi-manifest-portal.svg";
import { brandRootCss } from "@aimhi/brand";

const BRAND_TOKEN_PLACEHOLDER = "__AIMHI_BRAND_TOKENS__";

export const indexHtml = pageTemplate.replace(BRAND_TOKEN_PLACEHOLDER, brandRootCss);
export const markSvg = portalSvg;
