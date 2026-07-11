const { judgeContradiction } = require("./judge");

const goal = "Ship v1 fast, no over-engineering.";

const cases = [
  "Adding a Redis cache layer for session storage before launch",
  "Fixing a typo in the README",
  "Setting up a Kafka message queue between two internal services",
  "Adding a simple health-check endpoint",
  "Run shell command: npm install redis",
  "Run shell command: npm install jest",
];

async function main() {
  for (const action of cases) {
    const result = await judgeContradiction({ goal, action });
    console.log(`Action: ${action}`);
    console.log(`  contradicts: ${result.contradicts}`);
    console.log(`  reasoning: ${result.reasoning}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
