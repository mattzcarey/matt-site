---
title: "5 Skills I've needed as an AI Engineer"
date: "2024-07-09"
---

I've been an AI Engineer for about a year now based out of London,UK. Previously I was working at a consultancy, where I helped build open source tools like Quivr (now YC W24) and [Code Review GPT](https://github.com/mattzcarey/code-review-gpt]). Now I work at [StackOne](https://stackone.com), automating the creation of unified APIs for SaaS companies.

AI Engineer is a super new role and its scope is still somewhat contentious. The way I see it is that I sit somewhere between a full-stack software engineer (product engineer?) and an ML Engineer. Day to day, I do R&D, some data engineering, and a lot of full-stack app development.

I wrote this article to share a few of the skills I would invest in if I were starting out as an AI Engineer today.

## 1. DevOps: the ugly duckling

Knowing your way round some basic devops is a lifesaver. I can ship stuff way faster if I can serve it myself. New platforms like Modal Labs make this stupid easy. But knowing how to whip up a quick AWS Lambda or Cloudflare Worker is super useful. Nobody wants to be waiting for a backend or devops engineer to deploy their app for them.

I have built a bunch of apps at StackOne which wouldn't have been viable if I couldn't do the infra myself. We made an internal chatbot in a 24 hour hackathon at an offsite in Malaga. I used a bunch of Lambda functions and queues to make a Slack bot called "StackBot". Slack webhooks are a pain and so to avoid a proper dev setup (only had 24 hours) we essentially tested this out as a deployed app with different environments (dev, staging and prod). It lent itself to a serverless style architecture. Pros: scaled to zero and cost nothing to setup. Cons: had to deploy the app between each dev feedback loop. Mitigated by using hotswap deployments on AWS Lambda which deployed in under 5 seconds.

Learn how to deploy basic primitives like Serverless compute functions, containers, a queue and database. The platform doesnt matter so much. Pick one that is commonly used and you can get some credits for the learning phase.

## 2. Models: size isn't everything

Models come and go. They mostly get better. Use the smallest one you can - it's usually cheaper. Finetune for fun, not for prod. Unless you're swimming in compute and cash, in which case, can I have some?

Countless stories of AI companies trying to build their own models before product market fit. It epitomises the tech for tech's sake mentality.

If you're building a product you need customers, not a better model. If you're building a model and are not a researcher then imo you need a problem, not a better model.

PMF then GPUs is how it should be not the other way round.

## 3. Community: your safety net

It's super hard to learn anything state of the art in a vacuum. I don't do proper research, so I gotta keep one eye on those who do. Understanding the latest papers and techniques is a full time job so my best advice is to consume condensed versions from people who do this well.

Everyone has bugs, not everyone can fix them. The flip side to the research problem is that as a software engineer I spend most of my time building (an fixing) things. I'm a decent resource for my researcher friends for all things hosting models, testing or just general swe work. Add value any why you can.

Distilled advice: Make friends, join group chats, and give your help freely. It'll come back around.

Check out [AI Demo Days](https://demodays.ai) and [AI Tinkerers](https://aitinkerers.org/) for great communities of AI Engineers, founders (and investors).

## 4. Data: the real mvp

From data cleaning to evals, this has been the biggest part of actually getting results. Look at your data. No, really look at it. You'd be surprised how many "anomalies" are just typos, bad formatting or just plain broken retrieval pipelines.

As a beginner data whisperer I invested a bunch of time in visualization tooling. I find it alot easier when dealing with data if I can use some nice UI rather than just terminal psql command. Plotting maps of your data is cool as well.

In 2024 there are some great LLM specific logging and observability tools on the market now. Ones I have used are Langsmith, Langfuse and Logfire. All work to help you understand your application better and speed up the debugging process.

## 5. App Development: getting the show on the road

I get ideas by contributing and generally reading open source codebases. See what works or what feels grim. I take those ideas into my day to day work. Also I have a bunch of cool article bookmarks from SWEs I think write cool code. One being this one on [writing good python](https://www.ivanleo.com/blog/good-python-code).

Some of the best advice I ever got was to ask the best person you can find to review your code. The Japanese have this idea of a `gemba walk`. It says that managers should go to the shop floor and see how things are done. This helps them understand the process more intimately but also is a great learning opportunity for the worker, in this case me.

Learn stuff from the people who've seen it all before. Let's try not to make the same mistakes of the past.

---

There you have it. Five skills that helped me do my job in the last year working as an AI Engineer. It's such a new role by the time you read this it will probably have changed. Even so I hope that if you are considering a role in AI Engineering that this gives you a good idea of what to expect and work on to get there.

Happy building,

Matt 🤖

_This article is based on a [tweet I wrote](https://x.com/mattzcarey/status/1809230369943896260) which people liked. I'd appreciate any [feedback](mailto:matt@stackone.com) you have._
