---
title: "Advent of ML Day 3: Embeddings"
date: "2024-12-03"
bluesky_post_uri: "https://bsky.app/profile/mattzcarey.com/post/3lcftftzqvs2c"
---

We hear a lot about generative language models like Claude Sonnet and GPT-4, or open-source alternatives like the new QwQ models. However, there's a class of models we don't hear much about: embeddings models.

This will be the start of a few-day deep dive into using machine learning to build really good search systems across various document types.

You've probably heard of RAG (Retrieval Augmented Generation): Get a question, search for relevant context, include it in a prompt (hopefully containing the answer), and ask a generative model to answer based on that context. But how do you actually do the search part?

## Embeddings

Embeddings models translate tokens (see Day 1) into vectors - essentially lists of numbers - that represent semantic meaning in a high-dimensional space. Think of it like giving each piece of text coordinates in a vast semantic universe:

- Similar concepts end up close together
- Different concepts end up far apart
- Related concepts maintain meaningful distances

For example, in this space:

- "dog" and "puppy" might be very close
- "cat" would be relatively nearby (it's still a pet)
- "car" would be much further away
- But "vehicle" and "car" would be close to each other

Embeddings search is just a fancy name for finding the closest results to your query in the vector space. You can use cosine distance or other metrics to find the `nearest neighbors`.

## Model Architecture

Embeddings models generally start out as a pre-trained language model such as BERT (hello 2018). This is a smallish (by today's standards) deep learning model already trained to understand language. Some tricks are applied to extract how the model encodes the semantic meaning of tokens. They chop off the decoder (we only want the latent representation not the output) and add a projection layer to get to the final embedding size.

Models typically output vectors with 1,536, 3,072, or even bigger dimensions. Each dimension captures some aspect of meaning. The full vector represents the complete semantic content.

## Common Uses

1. **Semantic Search**

   - Convert documents and queries into embeddings
   - Find nearest neighbors in the vector space
   - Better than keyword matching (sometimes!)

2. **Recommendation Systems**

   - Embed items and user preferences
   - Recommend based on vector similarity
   - Works across different types of content

3. **Clustering and Organization**

   - Group similar documents automatically
   - Find themes in large collections
   - Create knowledge graphs

4. **Multimodal Applications**
   - CLIP-like models embed both images and text
   - Enable searching images with text (and vice versa)
   - Power multimodal AI applications

## Fine-tuning

While pretrained embedding models are powerful, fine-tuning them on your specific data can dramatically improve performance on your particular use case. It allows for better handling of domain-specific terms and nuances.

The training process involves:

- Curate a training set of pairs of items, where some pairs are marked as “similar” or "positive" (like sentences from the same paragraph) and some are marked as “different” or "negative" (like two sentences chosen at random)
- Train the model to distinguish between similar and different items

That's it! This process is relatively low-cost compared to other types of model training (see day 2) and can yield significant improvements. Below you can find a great article below on how to do this with a few hundred data samples on Modal. There is also a more in depth article by Tom Aarsen on the nuts and bolts of the Sentence Transformers library.

Interesting note: State-of-the-art embedding models are open source! Starting with relatively small pre-trained LLMs, advances in GPU-poor techniques and healthy competition have allowed open-source models to rival or even surpass proprietary ones. The best improvements often come from fine-tuning datasets and clever architecture tweaks—achievable without the massive budgets needed to train SOTA LLMs.

## Other Interesting Ideas

Before we wrap up, here are some fun avenues to explore to improve your search embeddings:

- **Late stage interaction with Vision Models**: Models like ColPali use Vision Language Models to embed document images directly, skipping OCR.

- **Dual Encoder Models**: By using separate encoders for queries and documents and optimizing them jointly, these models enhance retrieval performance by capturing nuances specific to each.

- **Synthetic Data Generation**: Creating artificial data that resembles potential queries can improve model robustness—a technique known as data augmentation.

- **Query Expansion**: Modifying queries to include additional relevant terms helps in retrieving more pertinent results, enhancing search effectiveness.

The next time you use a good search system or get a relevant recommendation, remember: there's probably an embeddings model working behind the scenes!

Happy day 3!

Matt

---

Resources:

- [An intuitive introduction to text embeddings](https://stackoverflow.blog/2023/11/09/an-intuitive-introduction-to-text-embeddings/)
- [How to Build a State-of-the-art Text Embedding Model](https://medium.com/snowflake/how-to-build-a-state-of-the-art-text-embedding-model-a8cd0c86a19e)
- [Fine-tuning Embeddings Efficiently - Modal Labs](https://modal.com/blog/fine-tuning-embeddings)
- [ColPali: Efficient Document Retrieval with Vision Language Models - Manuel Faysse](https://huggingface.co/blog/manu/colpali)
- [Training and Finetuning Embedding Models with Sentence Transformers v3 - Tom Aarsen](https://huggingface.co/blog/train-sentence-transformers)
