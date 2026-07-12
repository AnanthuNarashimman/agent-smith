const AGENT_LINES = [
  " █████   ██████  ███████ ███    ██ ████████ ",
  "██   ██ ██       ██      ████   ██    ██    ",
  "███████ ██   ███ █████   ██ ██  ██    ██    ",
  "██   ██ ██    ██ ██      ██  ██ ██    ██    ",
  "██   ██  ██████  ███████ ██   ████    ██    ",
];

const SMITH_LINES = [
  "███████ ███    ███ ██ ████████ ██   ██ ",
  "██      ████  ████ ██    ██    ██   ██ ",
  "███████ ██ ████ ██ ██    ██    ███████ ",
  "     ██ ██  ██  ██ ██    ██    ██   ██ ",
  "███████ ██      ██ ██    ██    ██   ██ ",
];

const LINES = AGENT_LINES.map((line, i) => line + " " + SMITH_LINES[i]);

function buildInterruptMessage(reasoning) {
  return [...LINES, "", reasoning].join("\n");
}

module.exports = { buildInterruptMessage };
