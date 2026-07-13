# kilo-openspec-libretto

[![license](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> A Kilo Code / Kilo CLI plugin that packages the
> [OpenSpec](https://github.com/Fission-AI/OpenSpec) spec-driven development
> workflow into a single installable package, exposing a **`libretto`**
> orchestrator agent that drives explore → propose → apply → verify →
> sync → archive.

## Prerequisites

- **Node.js ≥ 18**
- **OpenSpec CLI**: `npm install -g @fission-ai/openspec`
  (libretto depends on it at runtime for validation, status, and archiving)

## Installation

> ⚠ **Two steps required.** Step ① installs the CLI binary; step ② installs
> the agents and skills into Kilo.

**Step ① — Install the CLI**:

```bash
npm install -g kilo-openspec-libretto
```

**Step ② — Install into Kilo**:

```bash
kilo-openspec-libretto install
```

**Step ③ — Restart Kilo** (fully quit and reopen; **Reload Window** in VS Code).

After this, `libretto` appears in the agent picker — pick it to enter the
OpenSpec workflow.

**Step ④ — Initialize OpenSpec in your project** (per-project, once):

```bash
cd your-project
openspec init --tools none
```

> 💡 `--tools none` skips per-tool skill/command generation. openspec 1.6.0's
> adapters (e.g. `kilocode`) still write into `.kilocode/skills/`, but kilo CLI
> ≥ 7.4 (post-opencode refactor) no longer scans that directory — those files
> would be dead writes. libretto already provides its own prefixed skills
> (`libretto-*`) under `~/.kilo/skills/libretto/`, so we only need the
> `openspec/` workspace (config + changes/ + specs/).

## What gets installed

- **8 skills** under the `libretto` namespace (junction at
  `~/.kilo/skills/libretto`): core, explore, propose, apply-change,
  sync-specs, archive-change, verify-change, handoff.
- **3 agents**: `libretto` (primary orchestrator), `libretto-apply`
  (implementation subagent), `libretto-verify` (verification subagent).

## CLI usage

```text
kilo-openspec-libretto <command>

Commands:
  install     Install skills and agents (default)
  uninstall   Remove everything this package installed (manifest-based)
  update      Re-run install (idempotent)

Options:
  -v, --version    Show version
  -h, --help       Show help
```

### Environment variables

| Variable | Purpose |
|---|---|
| `KILO_HOME=<path>` | Override user home (for testing) |
| `KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1` | Skip openspec CLI detection |
| `KILO_LIBRETTO_DRY_RUN=1` | Print actions without modifying |
| `KILO_LIBRETTO_VERBOSE=1` | Verbose logging (stderr) |

## Update & uninstall

```bash
npm update -g kilo-openspec-libretto   # upgrade package
kilo-openspec-libretto update          # re-sync to Kilo (idempotent)

kilo-openspec-libretto uninstall       # remove artifacts
npm uninstall -g kilo-openspec-libretto
```

## Development

```bash
node --test     # zero-dependency tests
npm pack        # inspect the tarball
```

## Documentation

- [docs/specs/2026-07-14-libretto-design.md](docs/specs/2026-07-14-libretto-design.md) — locked design
- [docs/DESIGN.md](docs/DESIGN.md) — architecture summary
- [docs/INSTALLER.md](docs/INSTALLER.md) — installer spec
- [docs/AGENTS.md](docs/AGENTS.md) — agent specifications
- [docs/REFERENCES.md](docs/REFERENCES.md) — reference links
- [NOTICE](NOTICE) — OpenSpec CLI dependency attribution

## License

MIT — see [LICENSE](LICENSE). libretto's skills/agents/installer are original
work. Runtime depends on [@fission-ai/openspec](https://github.com/Fission-AI/OpenSpec)
(MIT).