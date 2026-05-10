import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Deps } from "./types";
import { registerCoreCommands } from "./core";
import { registerExploreCommands } from "./explore";
import { registerPlaybookCommands } from "./playbook";
import { registerMaintenanceCommands } from "./maintenance";

export function registerCommands(pi: ExtensionAPI, deps: Deps) {
  registerCoreCommands(pi, deps);
  registerExploreCommands(pi, deps);
  registerPlaybookCommands(pi, deps);
  registerMaintenanceCommands(pi, deps);
}
