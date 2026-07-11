# Agent Smith

A goal-fidelity watchdog for AI coding agents. Tell it your project's goal once, and it watches Claude Code's tool calls, interrupting — in character — when you're about to quietly contradict yourself.

> "Never send a human to do a machine's job."

## How it works

`smith init` records your project's stated goal. From then on, a local server checks risky Bash commands and file edits against that goal before Claude Code runs them. If an action looks like it contradicts what you said you wanted (e.g. adding Redis to a "ship v1 fast, no over-engineering" project), Claude Code shows you a permission prompt with Agent Smith's reasoning attached — you always make the final call. Every decision is logged, and a running **Consistency Score** tracks how often you've kept to your own word.


## License

ISC
