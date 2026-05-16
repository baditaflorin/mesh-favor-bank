import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-favor-bank",
  description: "Track favors between people via QR scans — ledger of who owes whom",
  accentHex: "#ec4899",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
