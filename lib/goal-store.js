const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const Supermemory = require("supermemory").default;

const DATA_DIR = process.env.SUPERMEMORY_DATA_DIR || path.join(process.cwd(), ".supermemory");
const BASE_URL = process.env.SUPERMEMORY_URL || "http://localhost:6767";

function getContainerTag() {
  let root;
  try {
    root = execSync("git rev-parse --show-toplevel", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    root = process.cwd();
  }
  return `project-${path.basename(root)}`;
}

function getApiKey() {
  if (process.env.SUPERMEMORY_API_KEY) return process.env.SUPERMEMORY_API_KEY.trim();
  const keyPath = path.join(DATA_DIR, "api-key");
  if (!fs.existsSync(keyPath)) {
    throw new Error(`No API key found at ${keyPath} and SUPERMEMORY_API_KEY is not set.`);
  }
  return fs.readFileSync(keyPath, "utf8").trim();
}

function getClient() {
  return new Supermemory({ apiKey: getApiKey(), baseURL: BASE_URL });
}

async function checkSupermemoryReachable() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function pollDocumentDone(client, id, { retries = 30, intervalMs = 500 } = {}) {
  for (let i = 0; i < retries; i++) {
    const doc = await client.documents.get(id);
    if (doc.status === "done") return doc;
    if (doc.status === "failed") throw new Error(`Document ${id} failed processing`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for document ${id} to finish processing`);
}

async function findGoal(client, containerTag) {
  const result = await client.search.memories({
    q: "project goal",
    containerTag,
    threshold: 0,
    filters: { AND: [{ key: "type", value: "goal", filterType: "metadata" }] },
  });
  return result.results[0] || null;
}

module.exports = { getContainerTag, getApiKey, getClient, pollDocumentDone, findGoal, checkSupermemoryReachable, BASE_URL };
