import { setupTelemetry } from "./telemetry.mjs";
import { runServer } from "./server.js";

setupTelemetry();

await runServer();
