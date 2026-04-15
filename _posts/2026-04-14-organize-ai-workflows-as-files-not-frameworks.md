---
layout: post
title: "Organize AI Workflows as Files, Not Frameworks"
categories: AI
tags: AI Agents MCP Workflows Prompts Architecture
author: Alan
summary: "A file-oriented AI architecture pattern where one agent connects to multiple workflows, and each workflow is broken into tasks, prompts, data, and tools."
level: Intermediate
---

* content
{:toc}

Many AI systems are built around orchestration frameworks such as LangChain, Agent SDKs, or Semantic Kernel. Those frameworks can be useful, but they also encourage application logic to be embedded deep inside code-heavy abstractions.

That creates a recurring problem: model providers continue to improve native tool use, planning, structured outputs, and multi-step execution. As those capabilities move into the models themselves, parts of the surrounding orchestration layer can become redundant or need constant rewrites.

One alternative is to move up an abstraction layer and organize the system around files.

## Core idea

Instead of treating the agent framework as the center of the system, the system can be organized around:

- one agent
- multiple workflows
- multiple tasks inside each workflow
- prompts, data, and tools attached to each task

The agent becomes the runtime decision-maker, while the file structure becomes the source of truth for what the system can do.

## Why this structure matters

A file-oriented structure changes the design in several useful ways:

- workflows become visible without reading application code
- prompts can be updated without changing core orchestration logic
- tools can be reused across multiple tasks
- task-level data dependencies become explicit
- model providers can be swapped more easily when the interface stays stable

This approach keeps the system focused on task organization instead of framework-specific wiring.

## Conceptual architecture

```text
Agent
  |
  +-- Workflow A
  |     |
  |     +-- Task 1
  |     |     +-- prompt
  |     |     +-- data
  |     |     +-- tools
  |     |
  |     +-- Task 2
  |           +-- prompt
  |           +-- data
  |           +-- tools
  |
  +-- Workflow B
        |
        +-- Task 1
              +-- prompt
              +-- data
              +-- tools
```

In this design:

- the agent handles reasoning and execution
- the workflow defines a business process
- the task defines a specific unit of work
- the prompt supplies instructions
- the data provides context
- the tools perform actions or lookups

## Relationship to model providers

The model layer remains replaceable. A workflow can still use:

- OpenAI
- Anthropic
- Google
- Llama
- local models

The important point is that model choice is no longer the organizing principle of the system.

Instead, the organizing principle becomes:

- what workflows exist
- what tasks each workflow contains
- what inputs and tools each task needs

This keeps the structure stable even when model behavior improves or provider APIs change.

## A file-tree example

One way to organize the system on disk is:

```text
ai-system/
  agent/
    agent.yaml
  workflows/
    customer-support/
      workflow.yaml
      tasks/
        classify-request/
          prompt.md
          data.json
          tools.yaml
        retrieve-account-context/
          prompt.md
          data.json
          tools.yaml
        draft-response/
          prompt.md
          data.json
          tools.yaml
    analytics-assistant/
      workflow.yaml
      tasks/
        interpret-metric-request/
          prompt.md
          data.json
          tools.yaml
        generate-sql/
          prompt.md
          schema.sql
          tools.yaml
```

That structure makes it easy to inspect:

- which workflows exist
- which tasks belong to each workflow
- where prompts are stored
- which tools and context each task requires

## Example task definition

The workflow runner can read structured metadata from files instead of hardcoding every task in Python or C#.

Example `task.yaml`:

```yaml
name: classify-request
description: Categorize the incoming support request
model: default
prompt_file: prompt.md
data_files:
  - data.json
tools:
  - search_customer_record
  - get_product_catalog
output:
  format: json
  schema: classification
```

Example `prompt.md`:

```md
Classify the request into one of these categories:
- billing
- account access
- product issue
- general question

Return structured JSON with:
- category
- urgency
- explanation
```

This keeps the instructions and task metadata outside the application runtime code.

## Role of MCP in this structure

MCP fits naturally into this design because it provides a stable interface for tools, resources, and prompts.

Instead of embedding tool definitions directly inside each framework layer, the workflows can reference MCP-exposed capabilities.

Example:

- prompts remain in files
- task definitions remain in files
- tools are exposed through MCP servers
- the agent runtime calls those tools when a task requires them

That means the system can keep a clean separation between:

- workflow definition
- tool serving
- model execution

## Why this can age better than framework-heavy orchestration

Framework-heavy designs often encode too much logic in runtime code:

- chain definitions
- agent routing layers
- custom memory wrappers
- provider-specific adapters

When model capabilities improve, some of that glue code may no longer be necessary.

A file-oriented design is less dependent on one generation of orchestration patterns because:

- prompts remain plain text
- tools remain explicit
- task structure remains inspectable
- workflows remain portable across runtimes

The orchestration runtime can change while the workflow definitions stay intact.

## A practical runtime pattern

A runtime built around this idea might work like this:

1. load the root agent definition
2. select the active workflow
3. load the task files for that workflow
4. attach the prompt, data, and tool references for the current task
5. call the selected model
6. invoke MCP tools if the task requires actions or retrieval
7. save outputs back into the workflow state

The important detail is that the runtime stays thin. Most of the system definition lives in files, not framework-specific code.

## Example runtime pseudocode

```python
workflow = load_workflow("workflows/customer-support/workflow.yaml")

for task in workflow.tasks:
    task_config = load_task(task.path)
    prompt = read_file(task_config.prompt_file)
    context = load_data_files(task_config.data_files)
    tools = resolve_mcp_tools(task_config.tools)

    result = run_agent_task(
        prompt=prompt,
        context=context,
        tools=tools,
        output_schema=task_config.output["schema"],
    )

    save_task_result(task.name, result)
```

This runtime code stays small because the workflow details are externalized.

## When this pattern is useful

This structure is especially useful when:

- multiple workflows share the same agent runtime
- prompts need to change frequently
- tools need to be reused across many tasks
- teams want workflow logic to be visible in the repository
- model providers may change over time

## Summary

The central idea is not that frameworks are always unnecessary. The central idea is that workflows, tasks, prompts, data, and tools can be treated as the primary architecture layer.

In that model:

- the agent is the execution layer
- workflows define business processes
- tasks define units of work
- prompts, data, and tools stay explicit and inspectable
- MCP provides a clean tool interface
- model vendors remain interchangeable beneath the workflow structure

This makes the system easier to inspect, easier to evolve, and less tightly coupled to one generation of orchestration frameworks.
