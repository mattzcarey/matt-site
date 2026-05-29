---
title: "Codebase Patterns for AI"
pubDate: "2025-07-18"
---

wip.

- **everything is tested.** this is the big one. tests are your contract. they're your documentation that the AI has done the right thing — the developer documentation, the contract between you and the code. the AI helps you write that contract. you have to invest in this, and then remove all the rest.

- **use a language that AI knows.**

- **set up repo tooling.** automatic tests, automatic linting, automatic type checking. be as strict as possible, but not pedantically strict.

- **have solid patterns for testing.** each new feature needs a test, and the test needs to look like *this*. document the patterns in `AGENTS.md`. have good fixtures so the agent can't (and doesn't want to) cheat — because it's easy to write good tests.

- **use linters extensively.** custom lint rules for bad practices and code smells. you can do things like restricting imports — basically trying to deal with the LLM-isms of our time.

- **keep docs in the repo.** keep them organised; they're the public-facing surface of your repo. when anyone wants to use it, you point them to the docs that live in the repo.

- **keep examples in the repo too.** docs and examples have different jobs: docs tell you *why* to do something, examples *demonstrate how* to do something.

so you have docs, you have tests, and you have examples. these are the things you work on. the code is the emergent property. i think this is really important.
