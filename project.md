# Agent Smith

**Hackathon:** Localhost:6767 (Supermemory Local) — July 9–13, 2026
**Builder:** Solo
**One-liner:** A goal-fidelity watchdog for AI coding agents — it remembers what you said you'd build, and calls you out when you quietly contradict yourself.

---

## Purpose

Long builds drift. You say "ship v1 fast, no over-engineering" on day one, and by day ten you're deep in a Redis cache you didn't need. Nothing in the current agentic coding workflow tracks that drift — CLAUDE.md is static, permission rules are about safety not intent, and every AI coding agent treats each session like it has no memory of what you promised yourself.

Agent Smith sits between you and your coding agent (Claude Code first, a second agent as stretch). It holds your stated project goal in persistent memory, watches the *decisions that matter* (not every keystroke), and interrupts — in character, as Agent Smith — when an action contradicts what you said you wanted. Overrides aren't ignored; they update the record and move a **Consistency Score** that tracks how much you've respected your own stated intent over the life of the project.

This is not a linter. It doesn't care about code style. It cares about whether you're still building the thing you said you were building.

---

## Non-Goals (deliberately out of scope for the hackathon)

Fitting the project's own theme, this list exists to stop *us* from scope-creeping the scope-creep detector.

- No multi-user / team features
- No web dashboard UI (terminal + `smith status` CLI output only)
- No fine-tuned/custom model — use an off-the-shelf LLM call for judgment
- No auto-amending the goal on override without the user seeing it happen (transparency > cleverness)
- No support for every possible coding agent — Claude Code is the MVP target; a second agent is a stretch goal only if time allows on Day 4
- Single-tier filtering only (see below) — no adaptive/learned filtering

---

## Core Concept

One pipeline, one server, one decision path:

```
Claude Code tool call (Bash / Edit / Write only — Read/Glob/Grep never reach us)
   ↓
PreToolUse HTTP hook → POST to local Agent Smith server (/analyze)
   ↓
Inside /analyze:
   1. Static keyword/filename check (package installs, infra tools, config files,
      destructive ops). No match → return "allow" immediately. Done.
   2. Match found → pull project goal + recent decision history from Supermemory
      Local (scoped by containerTag)
   3. LLM call: "does this action contradict the stated goal?"
      → No contradiction: "allow"
      → Contradiction: "ask", with Smith's reasoning as the permission prompt reason
   ↓
User sees the normal Claude Code permission prompt, with Smith's message attached.
User approves or denies — their own call, always.
   ↓
Outcome logged back to Supermemory:
   - what was flagged, what the user decided, when
   - if approved-anyway: goal record is explicitly amended (visible, not silent)
   - Consistency Score recalculated
```

---

## Data Model (Supermemory Local)

**Scoping:** `containerTag = project-<repo-name>` (derived automatically from the git repo, so no manual setup per project).

**Memory types stored per project:**
1. **Goal** — pinned, high-priority memory. The north star statement captured at `smith init`. Can be amended later (explicitly, via override flow), never silently overwritten.
2. **Decision log** — one entry per Tier-1 judgment call: action description, verdict, timestamp.
3. **Override log** — subset of decision log where user approved despite a contradiction flag. This is what the Consistency Score is computed from.

---

## Features (MVP — ship in 5 days)

1. **`smith init`** — CLI command, run once per project.
   - Prompts: "What's the north star for this build?"
   - Writes it to Supermemory as the pinned Goal memory under that project's `containerTag`.

2. **SessionStart check** — fires when Claude Code opens in a project folder.
   - If no Goal memory exists for this `containerTag` → surface a nudge to run `smith init`. No guessing from chat context.
   - If it exists → print current Consistency Score as a banner.

3. **PreToolUse HTTP hook → Agent Smith server**
   - Registered only on `Bash` and `Edit|Write` matchers in `.claude/settings.json`.
   - Server does the static filter first (Tier 0 logic, inline — not a separate service), then the LLM+Supermemory judgment only for what passes the filter.
   - Static filter list (hardcoded, editable JSON): package manager commands, infra keywords (redis, kafka, docker-compose, queue, microservice), destructive ops (rm -rf, migrations), and specific filenames (package.json, requirements.txt, docker-compose.yml, .env, schema/migration files).

4. **Contradiction verdict → `ask` (not hard `deny`)**
   - Smith's reasoning is attached as the `permissionDecisionReason` on a normal Claude Code permission prompt.
   - User makes the final call themselves, in their own terminal, in the moment.

5. **Override handling**
   - Approve-anyway is logged to the override log.
   - Goal record is explicitly, visibly amended ("goal updated: Redis added on [date], user override") — not silently rewritten.

6. **Consistency Score**
   - `kept / (kept + overridden)` across all flagged decisions for the project, expressed as a percentage.
   - Shown at every `SessionStart` and via `smith status` (which also lists the actual flagged history — what was caught, what was chosen).

7. **Session cache** — don't re-judge the same command/file twice in one session.

---

## Stretch Goals (only if Day 1–4 finish early)

- Second agent integration (OpenCode, via the existing community `opencode-supermemory` plugin) pointed at the same `containerTag`, proving cross-agent continuity of both the Goal and the Consistency Score.
- Debounce on rapid repeated Edit calls to the same file.

---

## Tech Stack

- **Server:** Node.js + Express (single service, one `/analyze` endpoint)
- **Memory:** Supermemory Local (`localhost:6767`), official SDK
- **LLM judgment call:** Anthropic API, fast/cheap model
- **Claude Code integration:** `.claude/settings.json`, `PreToolUse` hook, type `http`
- **CLI:** small Node CLI for `smith init` / `smith status`

---

## Hook Config (reference)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:PORT/analyze",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Server response shape on a flagged action:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "<Agent Smith's in-character reasoning here>"
  }
}
```

---

## 5-Day Plan

- **Day 1 (today):** Supermemory Local running locally. `smith init` writes/reads a Goal memory end to end. Confirm `containerTag` auto-derivation from repo name.
- **Day 2:** Agent Smith server + Claude Code HTTP hook wired. Ship the static filter with a hardcoded contradiction check first — prove the interrupt mechanic before making it smart.
- **Day 3:** Real LLM-judged contradiction detection against the stored goal. Tune Smith's voice/prompt. Build the decision log + override log writes.
- **Day 4:** Consistency Score calculation + `smith status`. Stretch: OpenCode integration if time allows.
- **Day 5:** Record demo, polish `smith status` output, write submission, buffer for bugs.

---

## Demo Script Outline

1. `smith init` — state the goal: "ship v1 fast, no over-engineering."
2. Do normal, on-goal work for a bit — no interrupts, fast, invisible.
3. Try to add something goal-contradicting (e.g. Redis for a v1). Smith interrupts in-terminal, in character.
4. Override it anyway — show the goal record updating, transparently, not silently.
5. `smith status` — show the Consistency Score, and the honest history of what got flagged and what was chosen.
6. Close on the score as the emotional beat: a number that tracks whether you kept your word to yourself.