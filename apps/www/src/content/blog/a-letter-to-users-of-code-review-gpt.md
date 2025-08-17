---
title: "A Letter to the Users and Contributors of Code Review GPT"
pubDate: "2024-07-10"
---

_Originally posted on the Code Review GPT GitHub repository [discussions board](https://github.com/mattzcarey/code-review-gpt/discussions/338)_

Hey everyone,

Thanks for all your interest and support of this package. Lots of changes have been happening in my life in the last 6 months hence the stall in progress. I wanted to share some updates on Code Review GPT and my thoughts about code review tools more widely.

Looking at the current state of market of these AI-powered review tools as of July 2024, Code Review GPT is up against increasingly sophisticated alternatives such as CodeRabbit and Codium. These companies are raising huge amounts of money to automate away the review process. The question is to me, whether this is sustainable or the right time to be doing this. Obviously raising money for this is not something that I am not going to do.

I believe there is another way to make a great tool especially in the code review space. Looking back over the last year I see that the majority of the gain in this field has not been from the advances in code understanding but by the increasingly performant agentic abilities of AI models such as Sonnet 3.5, and to some extent GPT 4o. This is not an advancement rate which more money or team members in these previously mentioned companies can alter.

I think there is a space for a more open method which piggybacks off these model advances and those of researchers in the space more than it does to create its own IP. An easily configurable, and flexible platform for code review and understanding, using primarily state-of-the-art foundational models but leaving the door open for locally fine-tuned LLMs. If this package provides the ability to use local models then it should also provide a method to build them easily. That is where I believe that this niche will lead and I want to bet on it.

Last summer I derailed this project trying to build out a SaaS tool. We decided to go with a Serverless specific hosting solution of a GitHub app. This was designed to be able to be easily deployed by us and used by you for some nominal fee. In this new phase I want to take this back to basics. I think we can get a huge amount done as a GitHub action and this will be more approachable to more people. We will not tie ourselves into another hosting provider. I will be building the package code into a container for deployment as an app if necessary but this will be secondary to the main package. This project should be about building the best open project not trying to make a quick buck.

For the short term I have some UX improvements on my mind for CRGPT. These are in no particular order:

- More (or less) than 3 comments on PRs. This solid limit is a hack and should be fixed.
- We should have a better method of judging code which actually looks at the changes as a cohesive mass not as individual files.
- A LGTM comment.
- Line by line for typos and regressions. Not prioritising chat.

Things I will not work on but will be very happy for others to:

- Supporting more foundational LLMs other than GPT4o and Sonnet 3.5
- More platforms such as Gitlab/Azure with a better integration.

Future upgrades:

- Better algorithms to understand the codebase. If we have to store artifacts we will store it in the codebase itself.
- Potential to have finetuned models and an ability to make them easily.
- Better testing and evals.
- Multiple methods of code understanding and judgement. Users will be able to pick the one they want and contribute new methods.

If anyone is looking for some open source LLM hobby contributions or maintainer roles please pop me a message. This new phase is going to need more than just me. You will be working for free (at least in the beginning), will need an interest in the space and preferably another job. If that sounds interesting let me know.

I have learnt a huge amount in this last year about code understanding and I am looking forward to build that back into this project.

Have a great week,
Matt
