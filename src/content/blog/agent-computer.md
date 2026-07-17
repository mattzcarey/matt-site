---
title: "Give your agent a computer"
description: "Keep the agent and its files durable, then give it a computer when it needs one."
pubDate: "2026-07-17"
tags:
  - agents
  - architecture
  - cloudflare
---

When I start a Claude Code on my laptop, it works on files and maybe runs a dev server. When I close the lid the agent might disappear but my laptop and its disk are still there (obs).

To run these agents in the cloud, my laptop becomes a VPS, sandbox, or container. The agent is free to be started and maybe stopped when done.

This is a perfectly sensible way to build one agent. I have a Raspberry Pi at home running this setup and it works great.

It gets awkward when you want to give every user an agent. Maybe more than one. They should wake for events, run in the background, and remember jobs that take days. Keeping a Linux machine around for each one just in case it needs shell access feels like the wrong shape.

Maybe we could make the agent durable and let the computers it uses be ephemeral.

## Split the harness from the tools

Katelyn Lesse described this in [You can't avoid the hard part](https://x.com/katelyn_lesse/status/2073902681668931927).

An early version of Claude Managed Agents spawned a sandbox, started Claude Code inside it, and kept the whole session in that container. Claude could not start thinking until it had booted. If it died, the session died. Code also ran beside MCP credentials.

Anthropic split the harness from where code runs. State has to survive when an execution environment does not. Files written by one tool need to be visible to the next. Credentials need to stay on the right side of the boundary.

## A durable agent with ephemeral hands

The harness owns durable identity and state. It sleeps when idle and wakes for a message, webhook, or schedule.

The tools are its hands. Reading a file might be a function over a durable store. A short script could run in an isolate. A strange build failure might need a container with a full Linux userspace.

```text
Durable agent / harness

  read / write / edit -------------> durable workspace
  execute(command)
    |-- isolate -------------------> same workspace
    `-- Linux computer ------------> borrow files
                                      run
                                      return changes
```

The workspace belongs to the agent, not to one of its tools.

If a container owns the filesystem, write a file through Bash and another tool might not see it. If the container dies, the agent loses its progress. Big sad.

Instead, the computer borrows the files it needs and returns its changes when it is done. It can disappear without taking the job state with it.

## One experiment with this pattern

At Cloudflare, we are testing one implementation in [`@cloudflare/workspace`](https://github.com/cloudflare/workspace). It is a preview for experiments and its design will change.

Cloudflare Workspace keeps a virtual filesystem in SQLite inside a Durable Object. A Worker backend runs [just-bash](https://github.com/vercel-labs/just-bash) in an isolate for cheap textual tools. A container backend exposes the same workspace through FUSE when the agent needs Linux.

## How much work needs a Linux box?

Less than I expected.

Take a normal coding task. The agent reads files, searches for a symbol, changes a few lines, checks the diff, and writes some notes. `read`, `write`, and `edit` can act directly on the durable workspace. No container. No sync.

Git operations can just call APIs. Parsers and bundlers can run inside an isolate. That covers a surprisingly large chunk of a coding agent's day.

Linux is still there for native binaries or whatever weird thing an arbitrary repository needs. Start it when the agent needs it, return the changes, then let it go. The agent is normally free to pick the backend it needs

## Where this fits

For one local agent, a durable computer is often the best design. The files are already there and there is no distributed system to operate.

The inversion makes more sense when agents outlive requests, wake in response to events, or run in large numbers. It can also make a useful security boundary: credentials stay with the harness while a tool receives limited files and network access.

You have to sync files, recover from partial failures, and decide what happens when two tools write at once. This pattern is useful when durability, scale, or isolation pays for that extra machinery.

Give your agent a computer when it needs one. Then let the computer go away. The agent should still be there.
