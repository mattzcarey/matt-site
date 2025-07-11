---
title: "Advent of ML Day 4: BM25 and Hybrid Search"
date: "2024-12-04"
bluesky_post_uri: "https://bsky.app/profile/mattzcarey.com/post/3lciimayze227"
image: "/images/og/advent-of-ml-day-4.png"
---

How do search engines actually work? When you type "cute cat videos" into a search bar, what's happening behind the scenes? And why do modern AI companies still use search algorithms from the 1990s?

[Yesterday, we explored embeddings models](./advent-of-ml-day-3.md) and how they enable semantic search. If you remember its all about finding the distance between vectors in a high-dimensional space. Today we are moving away from pure AI and looking at another older search method that still powers much of the internet today: keyword search or full-text search.

The tenuous link to AI is that a lot of AI powered applications implement a retrieval system to find relevant documents. Building a good search is a vital skill for many AI applications.

The idea behind keyword search is simple: look for documents that contain the exact words in your query. If you search for `python programming`, it will find documents with `python` and `programming` in them.

In practise it gets a little bit more complicated than that, but not much. For example, a document mentioning `python` once isn't as useful as a Python programming tutorial which will contain multiple references to `python` and `programming`. This is where BM25 comes in: an algorithm that has been the backbone of search engines since the 1990s.

## What is BM25?

BM25 (Best Match 25) is a ranking function that determines how relevant a document is to a search query based on the appearance of query terms in the document. It's the successor to TF-IDF (Term Frequency-Inverse Document Frequency) and was developed by Stephen Robertson and others at City University, London.

It has a pretty elegant mathematical formula:

$$
score(D,Q) = \sum_{i=1}^n IDF(q_i) \cdot \frac{f(q_i,D) \cdot (k_1 + 1)}{f(q_i,D) + k_1 \cdot (1 - b + b \cdot \frac{|D|}{avgdl})}
$$

Where:

- D is the document
- Q is the query
- f(qi,D) is the frequency of term qi in document D
- |D| is the length of document D
- avgdl is the average document length
- k1 and b are free parameters

Don't worry too much about about that – the key is that BM25 considers:

1. How often the query terms appear in a document
2. How rare those terms are across all documents
3. The length of the document (to avoid bias towards longer texts)

## Why BM25 Still Matters

While semantic search is powerful, BM25 has several advantages:

- Extremely fast and computationally efficient
- Excellent at finding specific terms such as product codes or IDs
- No training required
- Completely interpretable results
- Works well with technical terms and proper nouns

A strange fact is that over the last 20 years, users have been conditioned to use keyword search by using Google. They are often very good at naturally picking the right search terms, making BM25 a great method to have in your search stack.

Imagine you are looking for a replacement part for a washing machine or a specific computer. If you know the brand and/or model number, a keyword search will be very effective. Semantic search likely will be too general.

## Hybrid Search

As with many things in software, its all about the trade-offs. Different search tasks need different approaches. Consider these queries:

"What's the capital of France?"

- BM25 wins: The answer is probably in a document containing "capital" and "France"

"I'm looking for vacation spots with good surfing and a relaxed vibe"

- Embeddings win: Understanding the semantic meaning of "relaxed vibe" is crucial

The solution? Use both and combine them! A basic approach is using reciprocal rank fusion (RRF). Read more about that algorithm in the resources below. In future days we will cover more sophisticated options, such as the brand new Cohere Rerank v3.5, which adds a bit of deep learning to the mix.

## End-to-End Example

Let's build a simple hybrid search system in pseudocode:

```python
class HybridSearcher:
    def __init__(self, documents):
        # Initialize BM25
        tokenized_docs = [doc.split() for doc in documents]
        self.bm25 = BM25(tokenized_docs)

        # Initialize embeddings
        self.model = EmbeddingModel()
        self.doc_embeddings = self.model.encode(documents)
        self.documents = documents

    def search(self, query, k=10):
        # Get BM25 results
        bm25_scores = self.bm25.get_scores(query.split())
        bm25_results = [(i, score) for i, score in enumerate(bm25_scores)]
        bm25_results = sorted(bm25_results, key=lambda x: x[1], reverse=True)[:k]

        # Get embedding results
        query_embedding = self.model.encode([query])
        similarities = cosine_similarity(query_embedding, self.doc_embeddings)[0]
        embedding_results = [(i, score) for i, score in enumerate(similarities)]
        embedding_results = sorted(embedding_results, key=lambda x: x[1], reverse=True)[:k]

        # Combine results
        final_results = reciprocal_rank_fusion(bm25_results, embedding_results)
        return [(self.documents[i], score) for i, score in final_results[:k]]
```

## Takeaways

The best search system is the one that helps users find what they're looking for. If you haven't tried adding BM25 to your retrieval system, you should. It is quick to implement, and often worth just trying it out.

How do you know if it's working? Evals :) But that's a topic for another day.

See you tomorrow!

Matt

---

Resources:

- [Reciprocal Rank Fusion Explained in 2 mins](https://medium.com/@devalshah1619/mathematical-intuition-behind-reciprocal-rank-fusion-rrf-explained-in-2-mins-002df0cc5e2a)
- [Hybrid Search Implementation](https://docs.turbopuffer.com/docs/hybrid-search)
- [The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf)
- [Practical BM25: Part 2 - The BM25 Algorithm and its Variables](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables)
