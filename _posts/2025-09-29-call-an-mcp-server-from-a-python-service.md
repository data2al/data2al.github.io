---
layout: post
title: "Call an MCP Server From a Python Service"
categories: AI
tags: AI MCP Python FastMCP Services Automation
author: Alan
summary: "A follow-up example showing how a Python service can connect to an MCP server and call its tools over streamable HTTP."
level: Intermediate
---

* content
{:toc}

An MCP server is often only one part of the system. In many implementations, another service acts as the MCP client, connects to the server, and invokes tools or reads resources as part of a larger workflow.

With the official MCP Python SDK, a Python service can connect to a server over streamable HTTP by using:

- `streamable_http_client` for the transport
- `ClientSession` for the MCP session

## Install dependencies

Using `pip`:

```bash
pip install "mcp[cli]" fastapi uvicorn
```

Using `uv`:

```bash
uv add "mcp[cli]" fastapi uvicorn
```

## Example MCP client function

This example connects to an MCP server running at `http://localhost:8000/mcp`, initializes the session, and calls a tool named `add`.

```python
import asyncio

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


async def call_add_tool(a: int, b: int) -> dict:
    async with streamable_http_client("http://localhost:8000/mcp") as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            result = await session.call_tool("add", arguments={"a": a, "b": b})

            return {
                "structured": result.structuredContent,
                "content": [block.model_dump() for block in result.content],
            }


if __name__ == "__main__":
    response = asyncio.run(call_add_tool(5, 3))
    print(response)
```

## What this client code is doing

### `streamable_http_client(...)`

This opens the MCP transport connection to the server endpoint.

### `ClientSession(...)`

This creates the client session on top of the transport streams.

### `await session.initialize()`

This performs the MCP session initialization handshake before tools or resources are used.

### `await session.call_tool(...)`

This invokes the named MCP tool and passes arguments as a dictionary.

## Wrap the MCP client in a service

In many cases, the MCP client logic is embedded inside an API service. This example exposes a small FastAPI endpoint that calls the MCP server and returns the tool result.

```python
from fastapi import FastAPI

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

app = FastAPI()


async def call_add_tool(a: int, b: int) -> dict:
    async with streamable_http_client("http://localhost:8000/mcp") as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool("add", arguments={"a": a, "b": b})
            return {
                "structured": result.structuredContent,
                "content": [block.model_dump() for block in result.content],
            }


@app.get("/sum")
async def sum_numbers(a: int, b: int):
    return await call_add_tool(a, b)
```

## Run the service

If the FastAPI service is saved as `client_service.py`, it can be started with:

```bash
uvicorn client_service:app --reload
```

Then an HTTP request to the service:

```text
http://localhost:8001/sum?a=5&b=3
```

causes the service to call the MCP server and return the result.

## List tools before calling one

If the service needs to inspect server capabilities first, it can list available tools after initialization.

```python
async with streamable_http_client("http://localhost:8000/mcp") as (
    read_stream,
    write_stream,
    _,
):
    async with ClientSession(read_stream, write_stream) as session:
        await session.initialize()
        tools = await session.list_tools()
        print([tool.name for tool in tools.tools])
```

## Common service patterns

When a service calls an MCP server, a few patterns tend to matter:

- keep MCP connection logic in a dedicated function or client module
- initialize the session before tool calls
- treat tool names and arguments as part of the service contract
- validate upstream request parameters before forwarding them to the MCP server
- return structured tool output when available

## Notes

- the server endpoint for streamable HTTP is commonly exposed at `/mcp`
- `ClientSession` works on top of the transport returned by `streamable_http_client`
- `list_tools()` can be used to inspect capabilities before invoking a tool
- the same pattern can be extended to resources and prompts, not only tools
