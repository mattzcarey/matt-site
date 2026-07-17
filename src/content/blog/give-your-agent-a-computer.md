---
title: "Give your agent a computer"
description: "A pattern for building durable cloud agents: keep the harness and its files durable, then give it disposable execution environments when it needs them."
pubDate: "2026-07-17"
tags:
  - agents
  - architecture
  - cloudflare
---

> Give your agent a computer. Just do not make the computer the agent.

Most coding agents today run the other way around. The agent is a process that comes and goes. The computer is the durable infrastructure that stores its sessions and files.

That is what happens on my laptop. I start an agent, it works on files, and then I close the lid. The agent disappears. My laptop and its disk are still there. Move the same architecture to the cloud and the laptop becomes a VPS, a sandbox, or a long-lived container. The agent is still a guest in this devbox in the cloud. The machine is persistent, ideally.

This is a perfectly sensible way to build one agent. I have a Raspberry Pi at home running this kind of setup and it works great.

It gets awkward when you want to give every user an agent. Maybe more than one. These agents should wake up on schedules, react to events, run in the background, and remember jobs that take days. Keeping a Linux machine around for each one just in case it needs shell access feels like the wrong shape.

One way to architect that system is to invert it. Make the agent durable and let the computers it uses be ephemeral.

This is not the right pattern for every agent. It is one I think is worth exploring for cloud agents that need a durable identity without a permanently running machine.

## Split the harness from the tools

Katelyn Lesse described the hard part of this in [You can't avoid the hard part](https://x.com/katelyn_lesse/status/2073902681668931927).

An early version of Claude Managed Agents spawned a sandbox, started Claude Code inside it, and kept the whole session in that container. It was the simplest thing that could work. The container then became the source of several problems at once. Claude could not start thinking until it had booted. If it died, the session died. Code ran beside MCP credentials. Debugging a stuck session meant working out whether the harness, event stream, or container had failed.

The Anthropic team traced those problems back to one architectural choice: everything lived in one container. Fixing it meant separating the brain, the harness loop, from the hands, where code executes. It also meant accepting the distributed systems work that the first design had avoided.

That is the tradeoff. Once the brain and hands live in different places, something has to coordinate them. State has to survive when an execution environment does not. Files written by one hand need to be visible to the next. Credentials need to stay on the right side of the boundary.

## A durable agent with ephemeral hands

Lilian Weng defines the [agent harness](https://lilianweng.github.io/posts/2026-07-04-harness/) as the system around the model that manages how it acts, sees context, uses tools, stores artifacts, and evaluates results. That is the brain in this picture.

The harness can have one durable identity and a place for its state. It can sleep when nothing is happening and wake up for a message, webhook, or schedule. Durable does not mean a process burns CPU forever. It means the same agent comes back on demand.

The tools are its hands. Reading a file could be a function over a durable store. A short script could run in an isolate. Reproducing a strange build failure might need a container with a full Linux userspace. The harness could use several of these at once if the job needs it.

Every hand should receive the same workspace, even if they do not all reach it in the same way.

```text
Durable agent / harness

  read / write / edit -------------> durable workspace
  execute(command)
    |-- isolate -------------------> same workspace
    `-- Linux computer ------------> borrow files
                                      run
                                      return changes
```

The important part is ownership. The workspace belongs to the agent, not to one of its tools.

If a persistent container owns the filesystem, the agent's state is stuck in one of its hands. What happens if it writes a file through Bash and then tries to read it through a tool backed by a different store? It gets a not found. What happens if the container dies or runs out of memory? Big sad for your agent because it lost its progress.

In this pattern, the computer borrows the files it needs and returns its changes when it is done. It can disappear without taking the job with it.

There are several ways to build that boundary. You could use a network filesystem, snapshots in object storage, a database-backed virtual filesystem, or something else entirely. Each choice makes a different tradeoff around latency, consistency, and large file performance. The pattern does not depend on one storage product.

Sunil Pai has [written about Durable Objects as computers](https://sunilpai.dev/posts/durable-objects-are-computers/). I think of them as coordinators here. They give the agent a durable identity, colocate state and compute, and wake up when there is work to do. A different actor system or durable service could fill the same role.

## One experiment with this pattern

At Cloudflare, we are testing one implementation in [`@cloudflare/workspace`](https://github.com/cloudflare/workspace). It is a preview for experiments, not a production-ready answer, and its design will change.

Cloudflare Workspace keeps a virtual filesystem in SQLite inside a Durable Object. It currently has two ways to execute against those files:

- A Worker backend runs [just-bash](https://github.com/vercel-labs/just-bash) in an isolate. Commands such as `cat`, `grep`, `sed`, `awk`, and `jq` can operate on the workspace without starting Linux.
- A container backend exposes the workspace through FUSE to a normal Linux environment. It can run native binaries and use the network, then return file changes to the durable store.

That is one concrete set of choices, not the architecture itself. Another implementation could use a VM pool and object snapshots. It could keep state in Postgres. It might mount a network volume. What matters is that the agent owns its identity and files while execution environments can come and go.

## How much work actually needs Linux?

This is the part I keep coming back to: less than I expected.

Take a normal coding task. The agent reads files, searches for a symbol, changes a few lines, checks the diff, and writes some notes. It can do that for a long time before it runs anything interesting. `read`, `write`, and `edit` can act directly on the durable workspace. There is no reason to boot a computer for them.

Git looks like it needs a shell because most of us use it through the `git` command. [isomorphic-git](https://isomorphic-git.org/) can clone into a virtual filesystem, diff, commit, and push over HTTP. The harness keeps the credentials and gives the agent useful operations instead of the underlying key.

Code analysis can work the same way. [workerd-oxc](https://github.com/ghostwriternr/workerd-oxc) runs the Oxc parser and transformer inside a Worker. That covers useful linting and code analysis without starting Linux.

The Agents repository also has an experimental [worker-bundler](https://github.com/cloudflare/agents/tree/main/packages/worker-bundler). It runs `esbuild-wasm` in `workerd`, resolves npm packages, and can bundle a Worker or full-stack app from files in memory.

An isolate can read an app, edit it, parse it, lint it, bundle it, and run the result. That is a surprisingly large chunk of a coding agent's day.

Some of these jobs will start in a container because that is where the existing tool works. That is fine. If a path becomes common, it can move to a smaller execution backend later. The workspace does not move and the model can keep using the same tool. Only the hand changes.

## What still needs a computer?

Linux is the compatibility path. I want it when the behaviour belongs to Linux rather than to the task I am trying to complete.

Native Git is useful for SSH transport, hooks, submodules, worktrees, and exact CLI compatibility. Other jobs need native binaries, arbitrary package installation scripts, child processes, signals, PTYs, daemons, local sockets, or a runtime that is not available in an isolate.

Sometimes you simply do not know what a repository will need. An agent pointed at arbitrary open source code will find something weird.

A Linux computer gives us compatibility with forty years of developer tooling. We cannot beat that, and I do not want to. I just do not want to keep one around for every agent in case it is needed later.

## Where this pattern fits

For one local agent, a durable computer is often the simplest and best design. The files are already there, tools expect a normal filesystem, and there is no distributed system to operate. The same can be true for jobs dominated by large sequential I/O or long-running processes that are tightly coupled to one machine.

The inversion starts to make more sense when agents outlive individual requests, wake in response to events, or run in large numbers. It can also create a cleaner security boundary. Credentials stay with the harness, while a tool receives a narrow operation or limited files and network access.

There is a cost. You have to coordinate state, sync files, recover from partial failures, and define what happens when two hands write at once. A persistent computer avoids much of that work. This pattern is useful when durability, scale, or isolation pays for the extra machinery.

I am not sure the harness and workspace should always live together. They may split apart too. This is early, which is why I prefer to think of it as a pattern to test rather than the answer to how agents should be built.

Give your agent a computer when it needs one. Then let the computer go away. The agent should still be there.
