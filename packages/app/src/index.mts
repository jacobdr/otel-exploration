import { setupTelemetry } from "@otel-exploration/telemetry";
import packageJson from "../package.json";
import { runServer } from "./server.js";

setupTelemetry(packageJson);

await runServer();
