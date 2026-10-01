// Importing the package exposes read-only assurance functions; it never starts the server.
export { checkX402Endpoint, CheckInputError, BASE_MAINNET, BASE_USDC } from "./assurance.js";
export type { CheckRequest, AssuranceReport } from "./assurance.js";
export { verifyBaseSettlement } from "./proof.js";
export { createMeterMcpServer } from "./mcp.js";
export type { McpDependencies } from "./mcp.js";
export { handleMeterWebRequest, meterMethodNotAllowed } from "./web-mcp.js";
