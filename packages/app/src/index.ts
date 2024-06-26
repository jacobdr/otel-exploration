import { setupTelemetry } from "@otel-exploration/telemetry";
import packageJson from "../package.json";
import { runServer } from "./server.js";

async function main() {
  const { resource } = await setupTelemetry(packageJson);
  await runServer({ resource });
}

main();
