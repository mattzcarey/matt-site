---
title: "Speech on AI at the House of Lords"
date: "2024-09-15"
---

On September 11, 2024, I had the privilege of attending a roundtable discussion on AI openness at the House of Lords, hosted by Lord Wei. This event was part of a series of roundtable discussions scheduled between September and December, focusing on various aspects of AI policy and development with particular focus on AI openness. The roundtable featured speakers from industry and policy organizations, including parliamentarians such as Baroness Stowell.

I was invited to share my perspectives as a member of the OpenUK AI advisory board. Below is the quick speech I delivered as part of opening the discussion. It is not a polished speech and I am not a politician. I am an engineer trying to do my best to understand the issues and give my views.

---

Hello all. I am Matt Carey, an AI engineer and a member of the AI community here in London. I will give my views as a practitioner, as an open source contributor, as OpenUK AI advisory board member and as a team lead at a startup building and hiring here in London.

A quick note about definitions of AI openness. I find it funny, almost a quirk that open weights are considered open source. I cannot replicate an open weight model from purely the weights alone with no dataset. Therefore imo the 'source' is not really open and that model is effectively a black box. I have no interpretability on decision making and the best I can be is reactive with my observations.

I have a couple of points on the topic of AI regulation in this parliament and I'd like to raise some worrying trends I have been seeing which seem misguided.

Firstly, I would hugely discourage any regulation which affects individual developers directly, whether they be individual contributors or researchers. Regulations proposed such as putting arbitrary limits on the size of a model being trained (this is normally done in terms of parameters) or the number of FLOPS (operations/computation) used to train the model is a folly. These are almost meaningless metrics and can be fiddled in multiple ways. They will not tell you anything about the capabilities of the model or whether those capabilities are safeguarded against attacks or misuse. They are nice numbers, but not a good basis for policy. You can speak to me afterwards if you would like to chat more about the technicalities of these metrics.

Secondly, I would urge the policy makers to put their efforts into working with universities. Funding PHD programs to work on building better methods of model testing and understanding. We should embrace closed benchmarks and make strides into building our own. Government can use these to determine model strength in the future when deciding on thresholds for further regulation. Benchmarks such as the ARC Challenge have been successful in the regard of determining general model capabilities and policy makers would do well to make use of these. Older benchmarks have become saturated as models providers work to game the system and overfit to them, skewing the results in their favour. New closed benchmarks which test for things like AI safety, robustness and fairness are needed to give a fuller picture of model capabilities.

I think that we should also think about how policy makers can help support the building blocks of AI innovation in the UK. Talent is important but the best talent will achieve nothing without sufficient computational power to run their experiments. My company, like many, rent GPU's (these computers which are very good at the bulk mathematics needed for AI) from AWS and other US-based hyper-scalers. I would encourage policy makers to look to build sovereignty and security of this very limited compute resource with a creation of a UK Compute Fund. A sovereign compute cloud if you will, to be used by startups and universities to help build the UK as an AI superpower.

Lastly on the talent front and I don't have any answers here. We have a huge leaky bucket problem with talent leaving to go to the US. In the UK we have some of the best AI training institutions in the world, UCL, Imperial, Oxbridge and many more. We need to do more to support this talent in building and joining technical companies here in the UK, whether that be through tax breaks for investors, funding for incubators and the startup ecosystem or through other means.

Thank you for your time.
