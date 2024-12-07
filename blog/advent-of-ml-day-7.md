---
title: "Advent of ML Day 7: Transformers"
date: "2024-12-07"
image: "/images/og/advent-of-ml-day-7.png"
---

How did we get from simple neural networks to the powerful language models of today? What actually is a transformer? Today, we're having a look into the architecture that revolutionized natural language processing and laid the foundation for modern AI.

The story of transformers is fascinating because it represents one of those rare paradigm shifts where a new architecture completely changes what's possible. Before 2017, the idea that a model could write coherent paragraphs, generate code, or engage in meaningful dialogue seemed like science fiction. Now, it's reality.

## Before Transformers

Before the last 7 or so years, Recurrent Neural Networks (RNNs) were the go-to architecture. The idea was simple and intuitive: process text one word at a time, maintaining a "memory" of what came before. This worked reasonably well for short sequences but had major limitations:

1. **Vanishing Gradients**: As sequences got longer, the network struggled to connect information from many steps ago
2. **Sequential Processing**: Each word had to be processed one after another, making training slow
3. **Limited Context**: Practical limitations meant RNNs could only look back a few dozen words

Researchers tried various solutions. LSTMs (Long Short-Term Memory) and GRUs (Gated Recurrent Units) helped with the vanishing gradient problem. Bidirectional architectures allowed models to look at both past and future context. But these were incremental improvements.

## The Transformer

The 2017 paper "Attention is All You Need" introduced the Transformer architecture and changed the course of AI.

Attention itself had been around for a while. It was introduced in the 2014 paper from Yoshua Bengio's lab titled "Neural Machine Translation by Jointly Learning to Align and Translate". They combined RNNs with "context vectors" (what we now call attention).

Remarkably, both the original attention paper and the Transformer paper were focused on solving one specific problem: machine translation. Neither paper talked about creating a general-purpose sequence computer. They were just trying to make Google Translate better!

Also interesting is that neither papers were particularly well received by the research community at the time. They were considered a niche solution to a narrow problem. The Transformer was published at NeurIPS 2017, one of the top AI conferences worldwide. Yet it didn't even get an Oral presentation, let alone awards.

## What made Transformers special?

First lets have a quick primer on attention. Attention can be thought of like this: when you read a sentence, you don't process it one word at a time. You look at groups of words together, understanding how they relate to each other. This is what self-attention does. Transformer models are able to capture complex relationships in text that sequential models missed.

The Transformer was revolutionary because it pushed attention to the extreme. Instead of using attention as just one component alongside RNNs, it showed that attention alone could power the entire architecture. The model could look at the entire sequence at once, using pure self-attention to weigh the importance of different words in relation to each other.

This architecture unlocked unprecedented parallel processing capabilities on GPUs. Because attention can process all tokens simultaneously during training rather than waiting for sequential computations, training speed and scalability reached new heights. This was the game-changer that enabled the massive models we see today.

## What's Next?

The main drawback of transformers is that they are not memory efficient with long contexts. As every token attends to every other token, the memory requirements grow quadratically with the sequence length. This has sparked several interesting research directions:

### RWKV (Receptance Weighted Key Value)

RWKV combines the best aspects of RNNs and Transformers. It processes text sequentially like RNNs (making it more memory efficient) but uses mechanisms inspired by transformers to maintain performance. RWKVs can potentially handle much longer context windows with linear memory requirements.

### Alternative Attention Mechanisms

- **Paged Attention**: Implemented in vLLM, this approach manages attention computation more efficiently by breaking it into smaller chunks
- **Sparse Attention**: Only compute attention for the most relevant tokens, approximating the attention matrix to reduce complexity.
- **Flash Attention**: Optimizes memory access patterns for faster computation. Essentially it compresses operations into a single `fused` kernel.

### State Space Models

Recent work like the Mamba architecture shows promise in modeling sequences using state space models instead of attention. These models can process sequences in linear time and memory, potentially offering better efficiency for certain tasks.

While there's still fierce debate about whether transformer-based models can achieve AGI (Artificial General Intelligence), recent innovations in inference and training methods continue to push the boundaries of what's possible with transformers. For now it seems the 2017 authors were right and attention is really all you need.

Tomorrow we will look at attention in more detail.

Happy day 7!

Matt

---

Resources:

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- [Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)
- [RWKV: Reinventing RNNs for the Transformer Era](https://arxiv.org/abs/2305.13048)
- [Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752)
- [vLLM: Easy, Fast, and Cheap LLM Serving](https://docs.vllm.ai/en/latest/)
- [Flash Attention: Fast and Memory-Efficient Exact Attention](https://arxiv.org/abs/2205.14135)
- [ELI5: FlashAttention](https://gordicaleksa.medium.com/eli5-flash-attention-5c44017022ad)
