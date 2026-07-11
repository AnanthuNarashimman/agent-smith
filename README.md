# Agent Smith

A goal-fidelity watchdog for AI coding agents. Tell it your project's goal once, and it watches Claude Code's tool calls, interrupting — in character — when you're about to quietly contradict yourself.

> "Never send a human to do a machine's job."

## How it works

`smith init` records your project's stated goal. From then on, a local server checks risky Bash commands and file edits against that goal before Claude Code runs them. If an action looks like it contradicts what you said you wanted (e.g. adding Redis to a "ship v1 fast, no over-engineering" project), Claude Code shows you a permission prompt with Agent Smith's reasoning attached — you always make the final call. Every decision is logged, and a running **Consistency Score** tracks how often you've kept to your own word.

## Requirements

- Node.js >= 18
- [Claude Code](https://claude.com/claude-code)
- [Supermemory Local](https://supermemory.ai) running (`supermemory-server`)
- An API key for one LLM provider: Groq, OpenAI, Anthropic, or Gemini

## Install

```bash
npm install -g agent-smith
```

## Usage

```bash
# One-time setup per project: configures your LLM provider, Claude Code
# hooks, and prompts for your project's goal
smith init

# Check your current Consistency Score and flagged history
smith status
```

Inside Claude Code, you can also run `/smith-score` for the same status, presented conversationally.

## License

ISC
