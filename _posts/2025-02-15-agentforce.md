---
layout: post
title:  "Salesforce AgentForce"
categories: AI
tags:  AI Salesforce
author: Alan
---

* content
{:toc}

AgentForce is a cutting-edge platform from Salesforce that enables businesses to create autonomous AI agents. These agents collaborate with human employees to enhance customer experiences and optimize operations.

Key Capabilities:
1. Responds to inquiries, executes tasks, and follows instructions efficiently.
2. Operates across multiple Salesforce channels, assisting with daily workflows and communication.
3. Adapts to diverse business needs while maintaining compliance with organizational frameworks.



--- 

# Atlas Reasoning Engine

Atlas reasoning engine is designed to simulate human-like thought process within Salesforce, it is the "brain" behind AI agents, which can make decisions, take actions, and continuously learn - in real time.

In the example below, the agent interprets the users request to report an adverse event, underlining patient side effects caused by a certain drug. The drug information is pulled through a record search and finally an adverse event record is created. The reasoning engine basically went though: 
- Intent detection
- Query processing
- Planning/orchestration
- Action invocation

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;![agentforce_medicine](/img/blog/agentforce_medicine.jpg)

To better understand the Atlas Reasoning Engine, get some hands-on experience by clicking the link to the agentforce trailhead: [https://trailhead.salesforce.com/agentforce](https://trailhead.salesforce.com/content/learn/projects/quick-start-build-your-first-agent-with-agentforce/configure-an-agentforce-service-agent)

--- 

# What makes Agentforce special?

The "running user" provides service agents with data access and Apex class permissions, allowing them to perform tasks efficiently. Unlike Einstein Copilot, service agents rely on this predefined user because they function independently of the logged-in user's context. The Atlas Reasoning Engine maintains conversation context by storing key details in memory. This enables it to retrieve previously mentioned information, such as a medicine name, without requiring the user to repeat it, ensuring a smooth and efficient interaction.

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;![agentforce_medicine](/img/blog/salesforceai_architect.jpg)

\
&nbsp;