import { setupTelemetry } from "@otel-exploration/telemetry";
import { runServer } from "./server.js";

setupTelemetry();

await runServer();
