---
title: "Advent of ML Day 1: Tokenizers"
date: "2024-12-01"
---

Why do LLMs gaslit us that there are 2 Rs in Strawberry? Why is it so hard to get the right answer to the questions which is bigger, 9.8 or 9.11? The problem or at least some of the problem, is the fault of a component called a tokenizer.

Neural networks powering LLMs like GPT-4 and Claude Sonnet, ironically given the name large language model, cannot work with sentences very well. A tokenizer's job is to break down text into smaller units that the model can understand. These units, called tokens, can represent words, parts of words, or even individual characters. The most common approach used in modern language models is using an algorithm called Byte Pair Encoding (BPE).

## How BPE Works

BPE is an elegant algorithm that identifies and combines the most frequently occurring pairs of characters or subwords:

1. Start with a basic vocabulary of individual characters
2. Count all pairs of adjacent characters in the training data
3. Merge the most frequent pair and add it to the vocabulary
4. Repeat the process until reaching a desired vocabulary size

For example, let's see how BPE might process the word "strawberry":

- Initial split: s, t, r, a, w, b, e, r, r, y
- Common pairs might be merged: st, ra, rr, ry
- Final tokens might be: [st][raw][berry]

This explains why models might struggle with spelling - they see words as combinations of subword pieces rather than whole units. Moreover, the word "strawberry" might be tokenized differently in different contexts.

Check out [OpenAI’s handy tokenizer website](https://platform.openai.com/tokenizer) to see how your words are being split!

## Training a Tokenizer

Creating a tokenizer involves several key steps:

1. **Data Collection**: Gather a large, representative corpus of text in the target language(s)

2. **Preprocessing**: Clean the text and apply basic normalization (handling spaces, special characters, etc.)

3. **Vocabulary Building**:

   - Start with base characters
   - Apply BPE or similar algorithm to find common patterns
   - Create a final vocabulary of desired size (typically 32,000 to 50,000 tokens)

4. **Special Token Addition**: Add special tokens like [START], [END], [PAD], etc.

The resulting tokenizer is then "frozen" and used consistently for both training and inference of the language model.

## Why LLMs Can’t do Maths (yet)

Remember the "9.8 vs 9.11" example? The problem arises because numbers are often split into separate tokens. For instance:

- "9.8" might become ["9", ".", "8"]
- "9.11" might become ["9", ".", "1", "1"]

This tokenization makes it harder for the model to understand the numerical values as single units, leading to general confusion. The next time you see a language model make an strange mistake, consider if it could be the tokenizer playing tricks.

Happy day 1!

Matt

---

Resources:

- [Let's build the GPT Tokenizer - Andrej Karpathy](https://www.youtube.com/watch?v=zduSFxRajkE)
- [Tokenization counts: the impact of tokenization on arithmetic in frontier LLMs - Aaditya K. Singh, DJ Strouse](https://arxiv.org/abs/2402.14903)
- [Tiktoken - Github](https://github.com/openai/tiktoken)
