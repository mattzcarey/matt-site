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

The naive approach to running these agents in the cloud is my laptop becomes a VPS, sandbox, or container. The agent is free to be started and maybe stopped when done. The infra is persistant and contains the task state. 

This is a perfectly sensible way to build one agent. I have a Raspberry Pi at home running this setup and it works great.

It gets awkward when you want to give every user an agent. Maybe more than one. They should run across multiple client surfaces, run in the background, and remember jobs that take days or weeks. Keeping a Linux machine around for each one just in case it needs shell access feels like the wrong shape.

Maybe we could make the agent durable and let the computers it uses be ephemeral.

## Split the harness from the tools

Katelyn Lesse described this in [You can't avoid the hard part](https://x.com/katelyn_lesse/status/2073902681668931927).

An early version of Claude Managed Agents spawned a sandbox, started Claude Code inside it, and kept the whole session in that container. Claude could not start thinking until it had booted. If it died, the session died. Code also ran beside MCP credentials.

Anthropic split the harness from where code runs. State has to survive when an execution environment does not.

## A durable agent with ephemeral hands

The harness owns durable identity and state. It sleeps when idle and wakes for a message, webhook, or schedule.

The tools are its hands. And these tools can be run across many backend. Reading a file might be a function over a durable store. A short script could run in an isolate. A build tool might need a container with a full Linux userspace.

```text
Durable agent / harness

  read / write / edit -------------> durable workspace
  execute(command)
    |-- isolate -------------------> same workspace
    `-- Linux computer ------------> borrow files
                                      run
                                      return changes
```

The workspace belongs to the agent, not to one (or all) of its tools.

If a container owns the filesystem, reads and writes files. If the container dies or becomes disconnected from the agent, we loose its progress. Big sad.

Instead, the container spins up with the workspace loaded and syncs its changes back to the agent when done. The agent owns everything.

## One experiment with this pattern

At Cloudflare, we are testing one implementation in [`@cloudflare/workspace`](https://github.com/cloudflare/workspace). It is a preview for experiments and its design will change.

Cloudflare Workspace keeps a virtual filesystem in SQLite inside a Durable Object. A Worker backend runs [just-bash](https://github.com/vercel-labs/just-bash) in an isolate for cheap textual tools. A container backend exposes the same workspace through FUSE when the agent needs Linux.

## How much work needs a Linux box?

Less than I expected.

Take a normal coding task. The agent reads files, searches for a symbol, changes a few lines, checks the diff, and writes some notes. `read`, `write`, and `edit` can act directly on the durable workspace. No container needed.

Git operations can just call APIs (eg. Cloudflare Artifacts). Parsers and bundlers can mostly be run inside an isolate (if you are using one). That covers a surprisingly large chunk of a coding agent's tasks.

A container is necessary for native binaries or running a dev server. Start it when the agent needs it, return the changes, then let it go.

Note in this setup the agent is normally free to pick the backend it needs. The guidance you give the agent about which backend can change depending on where your tools are available. 

eg. Naresh has been porting [oxc parser to workerd](https://github.com/ghostwriternr/workerd-oxc) for us to run the oxc formatters and linters directly in Worker isolates. This task no longer needs a container to run. 

If you are working across multiple tech stacks your milage will vary but the pattern might still be useful. 

## Where this fits

For one local agent, a durable computer is often the best design. The files are already there and there is no distributed system to operate.

The inversion makes more sense when agents run across or connected to multiple clients, wake in response to events, or run in large numbers in the cloud. It can also make a useful security boundary: credentials stay with the harness (agent) while a tool receives limited files and network access.

There are distributed systems downsides. You have to sync files across a network, recover from partial failures maybe keep a warm pool of containers around. But in many cases I think it's worth it. 

Give your agent a computer when it needs one. Then let the computer go away. The agent should still be there.
