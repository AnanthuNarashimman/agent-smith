#!/usr/bin/env node
const readline = require("readline/promises");
const {
  getContainerTag,
  getClient,
  pollDocumentDone,
  findGoal,
  checkSupermemoryReachable,
  BASE_URL,
} = require("../lib/goal-store");
const { computeConsistencyScore } = require("../lib/consistency-score");
const { readConfig, writeConfig, PROVIDERS } = require("../lib/config");
const { ensureHooksConfigured } = require("../lib/hooks-setup");
const { ensureServerRunning, stopServer } = require("../lib/server-launcher");
const { ensureSkillConfigured } = require("../lib/skill-setup");
const { buildScoreBanner } = require("../lib/status-banner");
const { buildIntroBanner, pickNorthStarQuestion } = require("../lib/intro-banner");
const { clearProjectMemories } = require("../lib/reset");

async function requireSupermemory() {
  const reachable = await checkSupermemoryReachable();
  if (!reachable) {
    console.error(`Supermemory Local isn't running at ${BASE_URL}.`);
    console.error("Start it first, then re-run this command. See project.md for the startup command.");
    process.exitCode = 1;
    process.exit(1);
  }
}

async function ensureProviderConfig(rl) {
  const existing = readConfig();
  if (existing && PROVIDERS[existing.provider]) {
    console.log(`\nUsing existing ${PROVIDERS[existing.provider].label} configuration.`);
    return existing;
  }

  console.log("\nNo LLM provider configured yet for Agent Smith's judgment calls.");
  const providerNames = Object.keys(PROVIDERS);
  const providerInput = (await rl.question(`Which provider? (${providerNames.join("/")}) `)).trim().toLowerCase();
  if (!PROVIDERS[providerInput]) {
    throw new Error(`Unknown provider "${providerInput}". Choose one of: ${providerNames.join(", ")}`);
  }

  const apiKey = (await rl.question(`Enter your ${PROVIDERS[providerInput].label} API key: `)).trim();
  if (!apiKey) throw new Error("No API key entered, aborting.");

  console.log("Validating key...");
  await PROVIDERS[providerInput].ping(apiKey);
  console.log("Key validated.");

  const config = { provider: providerInput, apiKey };
  writeConfig(config);
  console.log("Provider configuration saved.");
  return config;
}

async function init() {
  await requireSupermemory();

  const containerTag = getContainerTag();
  const client = getClient();

  console.log(`containerTag: ${containerTag}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await ensureProviderConfig(rl);

  const hooksResult = ensureHooksConfigured();
  console.log(hooksResult.changed ? "\nClaude Code hooks configured." : "\nClaude Code hooks already configured.");

  const skillResult = ensureSkillConfigured();
  console.log(skillResult.changed ? "/smith-score command installed." : "/smith-score command already installed.");

  console.log("Starting Agent Smith server...");
  const serverResult = await ensureServerRunning();
  console.log(
    serverResult.started
      ? `Agent Smith server started on port ${serverResult.port}.`
      : `Agent Smith server already running on port ${serverResult.port}.`
  );

  const existing = await findGoal(client, containerTag);
  if (existing) {
    console.log(`\nA goal is already set for this project:\n  "${existing.memory}"`);
    console.log(`\n(last updated ${existing.updatedAt})`);
    rl.close();
    return;
  }

  console.log("\n" + buildIntroBanner());

  const question = pickNorthStarQuestion();
  const goal = (await rl.question(`\n${question}\n> `)).trim();
  rl.close();

  if (!goal) {
    console.log("No goal entered, aborting.");
    process.exitCode = 1;
    return;
  }

  console.log("\nWriting goal to Supermemory...");
  const added = await client.documents.add({
    content: goal,
    containerTag,
    metadata: { type: "goal", pinned: true },
  });

  console.log(`Queued as document ${added.id}, waiting for it to finish indexing...`);
  await pollDocumentDone(client, added.id);

  console.log("Reading it back to confirm...");
  const confirmed = await findGoal(client, containerTag);
  if (!confirmed) {
    throw new Error("Goal was written but could not be read back via search.");
  }

  console.log(`\nGoal set: "${confirmed.memory}"`);
  console.log("smith init complete.");
}

async function status() {
  await requireSupermemory();

  const containerTag = getContainerTag();
  const client = getClient();

  console.log(`containerTag: ${containerTag}`);

  const goal = await findGoal(client, containerTag);
  if (!goal) {
    console.log("\nNo goal set for this project yet. Run `smith init` first.");
    return;
  }
  console.log(`\nGoal: "${goal.memory}"`);

  const { score, flaggedCount, keptCount, overriddenCount, flaggedDecisions } = await computeConsistencyScore(
    client,
    containerTag
  );

  console.log("\n" + buildScoreBanner(score));

  if (score === null) {
    console.log("\n(nothing flagged yet)");
    return;
  }

  console.log(`\n${keptCount} kept / ${flaggedCount} flagged, ${overriddenCount} overridden`);
  console.log("\nFlagged history:");
  for (const d of flaggedDecisions) {
    const [actionLine, , reasoningLine] = d.content.split("\n");
    console.log(`  [${d.createdAt}] ${actionLine}`);
    if (reasoningLine) console.log(`    ${reasoningLine}`);
  }
}

async function off() {
  const result = await stopServer();
  console.log(result.stopped ? `Agent Smith server on port ${result.port} stopped.` : `No Agent Smith server was running on port ${result.port}.`);
}

async function reset() {
  await requireSupermemory();

  const containerTag = getContainerTag();
  const client = getClient();

  console.log(`containerTag: ${containerTag}`);
  console.log("This will permanently delete the goal, decision log, and override log for this project.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Type the project name to confirm: ")).trim();
  rl.close();

  if (answer !== containerTag.replace(/^project-/, "")) {
    console.log("Confirmation did not match, aborting. Nothing was deleted.");
    process.exitCode = 1;
    return;
  }

  console.log("Deleting...");
  const { deletedCount } = await clearProjectMemories(client, containerTag);
  console.log(`Deleted ${deletedCount} document(s). This project is now a clean slate — run \`smith init\` to set a new goal.`);
}

async function main() {
  const command = process.argv[2];
  if (command === "init") {
    await init();
  } else if (command === "status") {
    await status();
  } else if (command === "off") {
    await off();
  } else if (command === "reset") {
    await reset();
  } else {
    console.log("Usage: smith init | smith status | smith off | smith reset");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
