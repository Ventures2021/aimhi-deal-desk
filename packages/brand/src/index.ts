export const brandTokens = {
  obsidian: "#050713",
  midnight: "#10143A",
  lift: "#0B0F26",
  cobalt: "#1557FF",
  cobaltHover: "#3D74FF",
  cyan: "#00DDEB",
  crimson: "#F0204B",
  gold: "#B79A5B",
  white: "#F7F9FC",
  silver: "#B8C2D6",
  dim: "#8892AC",
  green: "#1FB57A",
  tealWhite: "#007A85",
  crimsonWhite: "#C41539",
  labelWhite: "#545E74",
  line: "rgba(184,194,214,.15)",
  lineStrong: "rgba(184,194,214,.28)",
  sans: 'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  mono: '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
} as const;

const toCssVarName = (name: string): string =>
  `--${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;

export const brandRootCss = Object.entries(brandTokens)
  .map(([name, value]) => `${toCssVarName(name)}:${value};`)
  .join("");
