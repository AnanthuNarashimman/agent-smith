const { checkToolCall } = require("./filter");

const cases = [
  { tool: "Bash", input: { command: "npm install redis" } },
  { tool: "Bash", input: { command: "git status" } },
  { tool: "Bash", input: { command: "rm -rf node_modules" } },
  { tool: "Bash", input: { command: "ls -la" } },
  { tool: "Bash", input: { command: "docker-compose up -d" } },
  { tool: "Edit", input: { file_path: "src/index.js" } },
  { tool: "Edit", input: { file_path: "package.json" } },
  { tool: "Write", input: { file_path: ".env" } },
  { tool: "Write", input: { file_path: "README.md" } },
  { tool: "Edit", input: { file_path: "migrations/0001_init.sql" } },
];

for (const c of cases) {
  const result = checkToolCall(c);
  const target = c.tool === "Bash" ? c.input.command : c.input.file_path;
  console.log(`[${result.matched ? "MATCH  " : "no-match"}] ${c.tool}: ${target}`);
  if (result.matched) console.log(`           -> ${result.reason}`);
}
