---
title: "Advent of ML Day 2: Data"
date: "2024-12-02"
---

Why do LLMs require such massive amounts of data? What exactly are data labellers, and why are they so important? What are the different ways AI models learn from data?

Large Language Models are, well, large. Llama 3.1 405B was trained on over 15 trillion tokens. To put it into perspective, the whole of Wikipedia contains about 2.24 billion tokens, 6,800x smaller in size!

So if you want to use a language model to solve a task, what data do you need to collect? Well, the answer is, as with most things: it depends. It turns out that we need very different types of data for different stages of LLM development.

## Crash Course on LLM Training

1. **Base Model Pre-training**

   - Uses massive amounts of data from different sources including the internet
   - Mostly unsupervised learning = no labels on the data
   - Builds general language understanding
   - Data is generally scraped from the internet and datasets like Common Crawl, Books, Wikipedia are used

2. **Reinforcement Learning from Human Feedback (RLHF)**

   - Pre-training data can often have a bunch of biases and not safe content.
   - RLHF reduces harmful outputs and allows model companies to add personality and preferences to the model
   - Very useful for chatbots and other applications that require a lot of human-like interaction
   - Requires data labellers (human annotators) to provide manual feedback on model outputs!
   - Dataset sizes are smaller than the pre-training stage (approx 10 - 100k samples)

3. **Fine-Tuning**

   - Used to add specific capabilities to the model
   - Needs carefully curated, task-specific datasets
   - Much smaller datasets than the previous stages (approx 100 - 10k samples)

4. **In-Context Learning (Prompting)**

   - Also gives the model knowledge of specific tasks
   - Uses some retrieval system to find relevant data and add it to the prompt
   - The whole process is normally called RAG (Retrieval Augmented Generation)
   - Normally uses 1- 10 samples (limited by usable context window)

## Which Stage do I Focus On?

The reality is that the first two stages of training are very expensive. Collecting huge amounts of clean data is hard. Adding consistent labels to model outputs is even harder and requires teams of trained annotators. As an LLM practitioner not working in a large lab you would mostly focus on the last two.

Generating data from larger models is a very interesting area of research. Generally called `synthetic data`, it is a way to create training data for smaller task specific models. We often call this process of taking a larger model and generating data for a smaller model `model distillation`.

## Why Data Matters

Understanding the role of data in LLM development helps us grasp both the capabilities and limitations of these models. When an LLM makes a mistake, it might be because:

- It never saw similar examples in training
- The training data was noisy or incorrect
- The labeling was inconsistent
- Contradictory information was supplied in the prompt
- Any combination of the above

Happy day 2!

Matt

---

Resources:

- [Google LLM Crach Course - Tuning](https://developers.google.com/machine-learning/crash-course/llm/tuning)
- [Introducing Llama 3.1](https://ai.meta.com/blog/meta-llama-3-1/)
- [Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155)
