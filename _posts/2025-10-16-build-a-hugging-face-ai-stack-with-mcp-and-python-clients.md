---
layout: post
title: "Build a Hugging Face AI Stack With MCP and Python Clients"
categories: AI
tags: AI Hugging-Face MCP Python FastMCP Automation
author: Alan
summary: "An infrastructure-oriented example that uses Hugging Face models behind an MCP server and calls task-specific models from a Python MCP client."
level: Intermediate
---

* content
{:toc}

A practical AI stack often has three layers:

1. a model layer that performs inference
2. a service layer that exposes those models in a controlled interface
3. a client layer that calls the service for specific tasks

One way to build that stack is:

- use Hugging Face for model loading and inference
- use MCP to expose multiple model-backed tools through one server
- use an MCP client to call the appropriate tool from another service

## Infrastructure layout

A simple deployment can be organized like this:

```text
Client Service
    |
    v
MCP Client Session
    |
    v
MCP Server
    |
    +--> Sentiment Model
    |
    +--> Summarization Model
    |
    +--> Classification or Routing Model
```

In that structure:

- Hugging Face models stay behind the MCP server
- MCP defines the interface for tools and resources
- the client service only needs to know the MCP endpoint and tool names

## Model layer with Hugging Face

Hugging Face `transformers` pipelines provide a simple way to load models for different tasks. A server can keep multiple pipelines in memory and route requests to the right one.

Example model setup:

```python
from transformers import pipeline

sentiment_model = pipeline(
    "text-classification",
    model="distilbert-base-uncased-finetuned-sst-2-english",
)

summarization_model = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6",
)
```

This creates:

- one model for sentiment classification
- one model for summarization

The same pattern can be extended to:

- zero-shot classification
- named entity recognition
- question answering
- text generation

## MCP server layer

The MCP server acts as the service boundary. Instead of exposing the models directly, the server registers one tool per task.

## Example MCP server with multiple models

```python
from mcp.server.fastmcp import FastMCP
from transformers import pipeline

mcp = FastMCP("HuggingFace AI Server", stateless_http=True, json_response=True)

sentiment_model = pipeline(
    "text-classification",
    model="distilbert-base-uncased-finetuned-sst-2-english",
)

summarization_model = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6",
)


@mcp.tool()
def analyze_sentiment(text: str) -> dict:
    """Run sentiment analysis on text."""
    result = sentiment_model(text)[0]
    return {
        "label": result["label"],
        "score": result["score"],
    }


@mcp.tool()
def summarize_text(text: str, max_length: int = 80, min_length: int = 20) -> dict:
    """Summarize a block of text."""
    result = summarization_model(
        text,
        max_length=max_length,
        min_length=min_length,
        do_sample=False,
    )[0]
    return {
        "summary": result["summary_text"],
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

## What this server design provides

- one endpoint for multiple AI tasks
- one MCP tool per model-backed function
- a stable interface for client services
- separation between model implementation and service consumers

## Why MCP helps with multiple models

When multiple models are hosted behind MCP:

- the client does not need direct Hugging Face model code
- the server can change model versions without changing client structure
- each task can be exposed as a named tool
- access control, logging, and routing can be added at the MCP layer

This is especially useful when one service needs:

- summarization for long text
- classification for short text
- a separate model for extraction or tagging

## Add model routing logic

Some systems use an explicit routing tool that selects which model to call based on the task name.

```python
@mcp.tool()
def run_task(task: str, text: str) -> dict:
    """Route text to the correct model-backed task."""
    if task == "sentiment":
        result = sentiment_model(text)[0]
        return {"task": task, "result": result}

    if task == "summary":
        result = summarization_model(text, max_length=80, min_length=20, do_sample=False)[0]
        return {"task": task, "result": result}

    return {"error": f"Unsupported task: {task}"}
```

This keeps the MCP interface compact while still allowing multiple models behind one server.

## Client layer: call the MCP server from a Python service

The client service connects to the MCP server over streamable HTTP and calls the tool that matches the task.

```python
import asyncio

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


async def call_sentiment(text: str) -> dict:
    async with streamable_http_client("http://localhost:8000/mcp") as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            result = await session.call_tool(
                "analyze_sentiment",
                arguments={"text": text},
            )

            return {
                "structured": result.structuredContent,
                "content": [block.model_dump() for block in result.content],
            }


async def call_summary(text: str) -> dict:
    async with streamable_http_client("http://localhost:8000/mcp") as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            result = await session.call_tool(
                "summarize_text",
                arguments={"text": text, "max_length": 60, "min_length": 15},
            )

            return {
                "structured": result.structuredContent,
                "content": [block.model_dump() for block in result.content],
            }


if __name__ == "__main__":
    sentiment = asyncio.run(call_sentiment("The service completed successfully."))
    print(sentiment)
```

## End-to-end request flow

An end-to-end request typically looks like this:

1. the client service receives a request
2. the client opens an MCP session to the server
3. the client calls the MCP tool for the target task
4. the MCP server runs the matching Hugging Face model
5. the result is returned to the client as structured output

## Operational considerations

For a production-style deployment, a few infrastructure decisions usually matter:

- load models once at startup rather than per request
- keep large models on machines with sufficient memory or GPU support
- separate light tasks and heavy tasks if latency differs significantly
- expose one MCP server with several task tools, or split into multiple MCP servers by domain
- add request logging and timeout handling at the service layer

## A common scaling pattern

One common pattern is to split the stack into:

- a lightweight MCP server for small NLP tasks
- a separate MCP server for heavier generation workloads
- a routing client or gateway that decides which MCP endpoint to call

That structure reduces resource contention between small classification calls and heavier summarization or generation requests.

## Notes

- Hugging Face `pipeline(...)` is commonly used for task-oriented inference in Python services
- MCP tools provide a stable interface for those model-backed tasks
- `streamable-http` is the recommended MCP transport for production-style HTTP deployments
- the same pattern can be extended to resources, prompts, and model metadata endpoints
