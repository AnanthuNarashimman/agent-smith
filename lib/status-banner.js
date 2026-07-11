const COLORS = { green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", gray: "\x1b[90m" };
const RESET = "\x1b[0m";

function colorForScore(score) {
  if (score === null) return "gray";
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function labelForScore(score) {
  if (score === null) return "NO DATA YET";
  if (score >= 80) return "HOLDING THE LINE";
  if (score >= 50) return "WAVERING";
  return "COMPROMISED";
}

function buildScoreBanner(score, { color = process.stdout.isTTY } = {}) {
  const scoreText = score === null ? "N/A" : `${score}%`;
  const label = labelForScore(score);
  const line1 = ` CONSISTENCY SCORE: ${scoreText}`;
  const line2 = ` ${label}`;
  const width = Math.max(line1.length, line2.length) + 1;
  const top = "╔" + "═".repeat(width) + "╗";
  const bottom = "╚" + "═".repeat(width) + "╝";
  const pad = (s) => "║" + s + " ".repeat(width - s.length) + "║";
  const lines = [top, pad(line1), pad(line2), bottom];

  if (!color) return lines.join("\n");

  const code = COLORS[colorForScore(score)];
  return lines.map((l) => code + l + RESET).join("\n");
}

module.exports = { buildScoreBanner };
