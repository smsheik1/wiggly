// Local operator surface, never registered as an agent tool. No provider credentials.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { StudioProduction } from "../../lib/studio-production.js";
import { provisionLocalOperator, signLocalOperator } from "../../lib/studio-operator.js";
const [root, action, input] = process.argv.slice(2);
if (!root || !existsSync(join(root, "studio.sqlite"))) throw new Error("EXISTING_ISOLATED_STUDIO_WORKSPACE_REQUIRED");
const store = new StudioProduction(root);
try {
  if (action === "init") console.log(JSON.stringify({ principal: provisionLocalOperator(store.root) }));
  else if (action === "director-queue") console.log(JSON.stringify(store.memoirDirectorQueue(input)));
  else if (action === "card") console.log(JSON.stringify(store.approvalCard(input)));
  else if (action === "apply") {
    const payload = JSON.parse(readFileSync(input, "utf8"));
    // Only an explicit local operator command provisions/signs; workers have no shell or access.
    const principal = provisionLocalOperator(store.root);
    if (payload.principal && payload.principal !== principal) throw new Error("OPERATOR_PRINCIPAL_DENIED");
    const command = signLocalOperator(store.root, { ...payload, principal });
    const result = payload.action === "decide" ? store.directorDecision(command) : payload.action === "extend_limits" ? store.authorizeLimits(command) : payload.action === "activate_memoir_policy" ? store.activateMemoirPolicy(command) : store.authenticatedProjectCommand(command);
    console.log(JSON.stringify(result));
  } else throw new Error("Use init, director-queue <project-id>, card <ticket-id>, or apply <command-json-file>");
} finally { store.close(); }
