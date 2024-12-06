---
title: "Advent of ML Day 6: Measuring Success"
date: "2024-12-06"
image: "/images/og/advent-of-ml-day-6.png"
---

How do you know if your AI system is working? What metrics should you track? When should you use LLM-as-a-judge? Over the past few days, we've explored various components of AI systems - from tokenizers to embeddings to hybrid search. Today, we'll tackle the crucial but often overlooked topic of evaluation.

I'm thinking about these questions a lot today. I've been building a new retrieval strategy at StackOne this week. It's been a lot of testing chunking, finding the limits of usable context windows and building datasets to try and test everything.

The changes feel good - response times are slower but within threshold, and the results look better at first glance. But "feeling good" and "looking better" aren't metrics you can track or improve upon systematically. This is the challenge at the heart of building AI systems: how do you measure success in a meaningful way?

## AI Testing

If you're coming from a software engineering background, the way people work in AI and ML might feel quite alien. It often seems like everyone is playing in notebooks rather than working on production systems. That's because the data flow in these systems is actually not that complex - take some data from somewhere, store some indexes in a DB, and at runtime query and send it to an LLM.

However, it's the knowledge and insight to build the right system that is hard to come by. As everyone has been telling me for the past two years, AI demos very well but production is hard. How do you handle adversarial questions? How do you handle hallucinations? How do you handle data drift? What do you do when your user uploads an 8,500-page PDF file of handwritten notes?

## Eval Strategy

### 1. Start with Simple Assertions

The simplest place to start is with basic string matching and assertions. Find test cases where you know exactly what the output should look like. While testing, literally add these assertions to your running code. This helps you:

- Get your prompts in the right space
- Ensure your system fails gracefully
- Build confidence in some basic functionality

For example, if you're building a system to extract dates from text, you might assert that "December 25th, 2024" is correctly identified as a date.

### 2. Measure Retrieval Quality

Retrieval (see [Day 3](./advent-of-ml-day-3.md), [Day 4](./advent-of-ml-day-4.md) and [Day 5](./advent-of-ml-day-5.md)) is normally where everything starts falling apart and can be the lowest hanging fruit for improvement. I've definitely been guilty of spending time making end to end tests when it was actually the retrieval that was the problem.

- Precision@K: How many of the top K retrieved documents are relevant?
- Recall@K: What fraction of relevant documents are in the top K?
- Mean Reciprocal Rank (MRR): How highly ranked is the first relevant document?

If you're using rerankers (from [Day 5](./advent-of-ml-day-5.md)), track the average reranker scores over time. A declining trend might indicate:

- Data drift in your source documents
- Changes in user query patterns
- Issues with your embedding model

### 3. LLM-as-a-Judge

LLM-as-a-judge isn't a silver bullet. Here are some guidelines:

- Avoid using models from the same family to evaluate each other (e.g., GPT-4o evaluating GPT-4o outputs). They tend to be overly nice to their family.
- Use pairwise comparisons instead of absolute scoring.
- Include clear evaluation criteria in your judge prompts
- Validate judge decisions against human evaluations

Models have no idea what "good" is, you will have more success with solid questions like: does this answer contain the 3 points from this reference answer? Be sure to validate your judges against human evaluations and include examples of good and bad in your prompts.

## Building Your Dataset

You need three things to start evaluating:

1. Representative questions/queries
2. Gold standard answers or relevance judgments
3. A process for collecting more data

The questions you should be able to get from users, your boss, or a previous product. The answers can be harder to come by.

### Subject Matter Expert (SME) Approach

- Find the person who knows your domain best, or buckle up cause this is going to be you.
- Send them one question per day via email or Slack and try get an answer back.
- Often the hardest part of this process is you have to become the SME yourself.

### Synthetic Data Generation

- Use larger models to generate test cases based on some examples and domain knowledge
- Validate a subset with humans
- Use for stress testing and edge cases

## Creating a Data Flywheel

The real power comes from creating a continuous improvement cycle:

1. Collect user interactions and feedback
2. Label and validate examples
3. Use validated examples to:
   - Improve retrieval
   - Train better judges
   - Generate synthetic data
4. Feed improvements back into production
5. Repeat

This flywheel effect not only improves your current system but also opens up possibilities for fine-tuning models and more sophisticated strategies in future.

## Practical Tips

1. **Start Small**: Begin with a core set of test cases that represent your most important use cases.

2. **Log Everything**: You can't improve what you don't measure. Log:

   - User queries
   - Retrieved documents
   - Generated responses
   - User feedback (explicit and implicit)

3. **Build for Iteration**: Your first evaluation system won't be perfect. Design it so you can easily:

   - Add new test cases
   - Modify evaluation criteria
   - Update gold standard answers

4. **Make Evaluation Easy**: Remove friction from the evaluation process:
   - Build simple tools for annotators
   - Automate what you can
   - Make results easily accessible

Remember, the goal isn't to achieve perfect scores on your metrics - it's to build a system that reliably helps your users. Sometimes a simple system with clear limitations is better than a complex one that fails in unpredictable ways.

Happy day 6!

Matt

---

Resources:

- [Your AI Product Needs Evals - Hamel Hussain](https://hamel.dev/blog/posts/evals/)
- [Applied LLMs - Evaluation Monitoring](https://applied-llms.org/#evaluation-monitoring)
- [LLM Judge - Hamel's Blog](https://hamel.dev/blog/posts/llm-judge/)
- [Who Validates the Validators? - Shreya Shankar et al.](https://arxiv.org/abs/2404.12272)
- [How Dosu Used LangSmith for Continual Learning](https://blog.langchain.dev/dosu-langsmith-no-prompt-eng/)
