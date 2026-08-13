import pageTemplate from "../public/index.html";
import { brandRootCss } from "@aimhi/brand";

const BRAND_TOKEN_PLACEHOLDER = "__AIMHI_BRAND_TOKENS__";

export const indexHtml = pageTemplate.replace(
  BRAND_TOKEN_PLACEHOLDER,
  brandRootCss,
);
export const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">
<title id="title">AiMhi signal cluster</title><desc id="desc">Four colored signal panels converge around a detected opportunity.</desc>
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1557FF"/><stop offset="1" stop-color="#004D57"/></linearGradient><linearGradient id="b" x1="1" y1="0" x2="0" y2="1"><stop stop-color="#00DEEB"/><stop offset="1" stop-color="#1557FF"/></linearGradient><linearGradient id="c" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#7A47FF"/><stop offset="1" stop-color="#1557FF"/></linearGradient><linearGradient id="d" x1="1" y1="1" x2="0" y2="0"><stop stop-color="#E21A66"/><stop offset="1" stop-color="#FF1E56"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="3"/></filter></defs>
<path fill="url(#a)" d="M27 33l86 24-9 57-86-14z"/><path fill="url(#b)" d="M143 52l86-19-17 70-71 13z"/><path fill="url(#c)" d="M20 135l84 7 9 65-79 17z"/><path fill="url(#d)" d="M141 142l71-12 17 80-86-18z"/>
<circle cx="126" cy="128" r="25" fill="#050713" opacity=".75" filter="url(#g)"/><circle cx="126" cy="128" r="10" fill="#F7F9FC"/><circle cx="126" cy="128" r="4" fill="#00DEEB"/>
</svg>`;
