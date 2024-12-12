---
title: "Advent of ML Day 11: Test Time Compute"
date: "2024-12-11"
image: "/images/og/advent-of-ml-day-11.png"
bluesky_post_uri: "https://bsky.app/profile/mattzcarey.com/post/3ld4mrgrmr22s"
---

_Quick Note: Day 11 of Advent of ML is kindly sponsored by [ElevenLabs](https://elevenlabs.io). You can now listen to this post, as well as the rest of the Advent of ML series, read aloud by AI-generated Matt._

Imagine you're taking a difficult math test. Would you perform better if you had a bigger brain, or if you had more time to think about a problem? This isn't just a weird philosophical question - it's at the heart of some interesting research in artificial intelligence: scaling of computational resources at test time.

## Models That Can Reason

OpenAI unveiled their O1 models in September 2024, the first models with an inbuilt chain of thought. O1 models generate special tokens which act as a notepad for the model to write down their 'thoughts'. These models don't just rush to spit out answers. They pause. They reflect. They sometimes even go back and revise their thoughts. To do this OpenAI had to spend a lot more computation at inference/run time (often called test time) to get this bump in reasoning performance.

This is a big departure from the traditional approach to AI scaling which basically stated: more training data + more GPU hours = better model. The first chain of thought (COT) paper came out in January 2022, however O1 is the first model series which has included COT in the model/api architecture without a need for additional prompting or fine tuning.

A few months before the O1 release, the Large Language Monkeys paper, explored the idea of increasing the number of samples generated at test time. Using a formal verification process to validate the solutions, they found increases from 15.9% with one sample to 56% with 250 samples on the SWE-Bench-Lite benchmark (a popular programming benchmark), beating the previous state of the art of 43%.

Large Language Monkeys also found that the relationship between coverage and the number of samples is log-linear and can be modelled with an exponentiated power law, suggesting the existence of a previously unexplored inference-time scaling law. Essentially, if you can build a verifier for your task, you should scale the number of samples you generate at test time to improve performance.

## The Pattern-Matching Problem

In research circles there is still a lot of debate about whether models actually 'reason'. One of the more popular benchmarks used to test reasoning is the Abstraction and Reasoning Corpus for Artificial General Intelligence (ARC-AGI or just ARC). When François Chollet created ARC in 2019, he was trying to prove a point about AI's limitations. His stance is that AI systems aren't really thinking at all. They are pattern matching machines and true intelligence isn't about pattern matching - it's about being able to derive novel solutions.

The ARC-AGI presented deceptively simple visual puzzles that required discovering underlying rules from just a few examples. They are really quite easy for humans. However, for the last few years, AI progress was slow. From 2020 to early 2024, the top score only increased from 20% to 33%. Even as language models got dramatically better at other tasks, they remained stumped by ARC. The original GPT-3 scored 0% via direct prompting.

![ARC-AGI](/images/arc-agi.png)

Example ARC-AGI task (0ca9ddb6)

_picture credit: [ARC Prize 2024: Technical Report](https://arcprize.org/media/arc-prize-2024-technical-report.pdf)_

## Paths to Better Reasoning

The year 2024 witnessed significant breakthroughs in ARC scores, primarily driven by the concept of scaling at test time. During the 2024 ARC Prize competition, a $1 million challenge to surpass and open-source a solution to ARC-AGI, scores improved dramatically, with MindsAI achieving an impressive 55.5% on the private evaluation set. The most successful strategies can be summarized into three categories, which are explored in more detail in the ARC Prize 2024 technical report.

### Deep Learning-Guided Program Synthesis

Ryan Greenblatt's groundbreaking approach showed how to use test-time compute for systematic exploration:

- Generate thousands of potential Python programs for each puzzle
- Use an LLM (GPT-4o) to guide the search and debug promising candidates
- Keep refining solutions through multiple iterations
- Apply sophisticated verification to test programs against examples

The key insight was using the LLM not to solve the problem directly, but to guide a search through program space. With enough computation time, this approach achieved up to 42% accuracy.

### Test-Time Training (TTT)

MindsAI pioneered a different strategy that showed the power of real-time adaptation:

- Generate additional variations of the example problems
- Apply stability-based selection criteria to validate solutions
- Additional fine-tuning is performed on these specific transformations

This "test-time training" proved that models could effectively learn from just a few examples during inference, challenging the traditional fixed-model paradigm.

### Hybrid Approaches

The most successful team, ARChitects - 53.5%, recognized that different puzzles needed different strategies. They used a combination of heuristics to determine the best approach for each puzzle. Then they used a combined method of program synthesis with direct prediction (input + task description => solution) and applied these multiple solving strategies in parallel.

### Selective Information Fine-Tuning

Although not applied to ARC (yet), there is a new paper from Jonas Hubotter et al. at ETH Zurich, Switzerland which shows a new approach to test-time compute scaling. They call it Selective Information Fine-Tuning (SIFT). Similarly to the MindsAI approach on ARC, SIFT allows models to learn and adapt during use by performing some training of the model on the fly. The key innovation is how it selects what to learn from - optimizing for information gain rather than just similarity.

Whereas test time training (TTT) generates a new training set from each example, SIFT uses an external corpus of data from which it selects specific fine-tuning examples. This approach should be much more generally applicable to problems where you have an external corpus of data already available.

## Learnings from ARC 2024

The ARC challenge revealed a fundamental trade-off in how computation time can be used through this new scaling law. Program synthesis approaches excel at problems with precise, rule-based answers, but their cost grows exponentially with program complexity. Test-time training, on the other hand, shows particular strength in pattern recognition tasks by fine-tuning on specific examples during inference. The most successful systems learned to combine both approaches.

However, important limitations remain. Even infinite compute time cannot overcome a model's basic limitations - if a model lacks the architectural capacity or training to understand certain concepts, no amount of test-time computation will help. A model's base quality strongly influences its maximum achievable performance through test-time compute, suggesting these techniques amplify existing capabilities rather than creating new ones.

Real-world applications face several practical challenges. Program synthesis approaches face exponentially growing costs as program size increases. Test-time training requires significant computation for each example. Perhaps most challengingly, verification remains difficult - determining whether a solution is correct often requires either expensive computation or imperfect heuristics. These imperfect verifiers place an upper bound on achievable accuracy.

The massive increase in performance in ARC-AGI during 2024 suggests we're at an interesting inflection point in AI development. While we still haven't achieved human-level reasoning (humans easily score 97-98% compared to the current best of 55.5%), we're seeing new approaches that look more like genuine problem-solving than pure pattern matching. And the stand out technique has been scaling at test time, whether by generating samples or training or a combination of both.

Perhaps most importantly, these developments are forcing us to reconsider what we mean by "intelligence." Instead of just building bigger pattern-matching machines, we're starting to create systems that can actually explore, reason, and learn from their attempts - even if it takes a little more compute at run time.

Personally, I am interested in seeing how these techniques will be used by developers to build more intelligent application and whether the compute requirements for AI will shift from the current training dominated allocation to a more balanced allocation with test time compute being another control knob to dial in.

Happy day 11!

Matt

---

Resources:

- [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903)
- [Large Language Monkeys: Scaling Inference Compute with Repeated Sampling](https://arxiv.org/abs/2407.21787)
- [Scaling LLM Test-Time Compute Optimally](https://arxiv.org/abs/2408.03314)
- [Efficiently Learning at Test-Time: Active Fine-Tuning of LLMs](https://arxiv.org/pdf/2410.08020.pdf)
- [François Chollet on Pattern Recognition vs True Intelligence](https://www.youtube.com/watch?v=JTU8Ha4Jyfc)
- [ARC Prize](https://www.arcprize.org)
