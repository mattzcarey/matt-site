---
title: "5 Skills I Needed to Survive as an AI Engineer"
date: "2024-07-09"
---

I've been an AI Engineer for about a year now. Previously at a consultancy, where I helped build open source tools like Quivr (now YC W24) and Code Review GPT, and now at a startup called StackOne based out of London.

At StackOne I write code which builds integrations. We provide a unified API for a multitude of SaaS products across different industries like HR ATS (recruitment), CRMs, Marketing, LMS (learning stuff) and more. Building these integrations is time constrained. My part is to make the first pieces to automate the building of these integrations at massive scale. I joke that I am automating myself out of a job with each release. And sometimes it doesnt feel like a joke, that is the end goal.

The AI Engineer is a super new role, and so I didn't really know what to expect. The way I see it is that it sits somewhere between a full-stack software engineer (product engineer?) and an ML Engineer. I do R&D, some data engineering, and a lot of full-stack app development.

StackOne is a small team and we all wear many hats. These are a collection of skills which I have found most useful in my role as an AI Engineer.

## 1. DevOps: the ugly duckling

Knowing your way round some basic devops is a lifesaver. I can ship stuff way faster if I can serve it myself. New platforms like Modal Labs make this stupid easy. But knowing how to whip up a quick AWS Lambda or Cloudflare Worker is super useful. Nobody wants to be waiting for a backend or devops engineer to deploy their app for them.

I have built a bunch of tiny apps at StackOne which just wouldn't have been viable if I couldn't do the infra myself. We made an internal chatbot for customer success in a 24 hour hackathon at an offsite in Malaga. I used a bunch of Lambda functions and queues to make a scalable Slack bot called "StackBot". Webhooks are a pain and so to avoid a proper dev setup (only had 24 hours) we essentially tested this out as a deployed app. This lent itself to a serverless style architecture which deployed in under 5 seconds. Hotswap deploys on lambda worked well.

## 2. Models: size isn't everything

Models come and go. They mostly get better. Use the smallest one you can - it's usually cheaper. Finetune for fun, not for prod. Unless you're swimming in compute and cash, in which case, can I have some?

Countless stories of AI companies trying to build their own models before PMF. PMF then GPUs is how it should be not the other way round.

## 3. Community: your safety net

It's super hard to learn anything state of the art in a vacuum. I don't do proper research, so I gotta keep one eye on those who do. Everyone has bugs, not everyone can fix them. Make friends, join group chats, and give your help freely. It'll come back around, trust me.

Check out DemoDays AI. It's like a support group for AI nerds, but with cooler toys.

## 4. Data: the real mvp

From data cleaning to evals, this has been the biggest part of actually getting results. Look at your data. No, really look at it. You'd be surprised how many "anomalies" are just typos, bad formatting or just plain broken retrieval pipelines.

## 5. App Development: getting the show on the road

Contribute and read open source codebases. See what works or what feels grim. Get the best person you can find to review your code. The Japanese have this idea of a gemba walk. Do that, but for code. Pick their brains. Learn stuff from the people who've seen it all before.

---

There you have it. Five skills that kept me from losing my mind (mostly) in last year working as an AI Engineer.

Happy coding 🤖

_This article is based on a [tweet I wrote](https://x.com/mattzcarey/status/1809230369943896260) which people liked. I'd appreciate any [feedback](mailto:matt@stackone.com) you have._
