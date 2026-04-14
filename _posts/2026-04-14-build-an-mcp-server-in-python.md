---
layout: post
title: "Build an MCP Server in Python"
categories: AI
tags: AI MCP Python FastMCP Automation
author: Alan
summary: "A reference example for building a simple MCP server in Python with the official MCP Python SDK."
level: Intermediate
---

* content
{:toc}

The Model Context Protocol (MCP) is a standard for exposing tools, resources, and prompts to LLM applications. In Python, the official SDK provides a `FastMCP` interface for defining a server and registering capabilities.

At a high level, an MCP server can expose:

- tools for actions or computation
- resources for retrievable data
- prompts for reusable interaction templates

## Install the Python SDK

The official Python SDK supports standard package installation with `pip`, and its documentation recommends `uv` for Python project management.

Using `pip`:

```bash
pip install "mcp[cli]"
```

Using `uv`:

```bash
uv init mcp-server-demo
cd mcp-server-demo
uv add "mcp[cli]"
```

## Create a minimal MCP server

This example defines:

- one tool that adds two numbers
- one resource that returns a greeting
- one prompt that generates instruction text

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Demo", json_response=True)


@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Return a greeting resource."""
    return f"Hello, {name}!"


@mcp.prompt()
def greet_user(name: str, style: str = "friendly") -> str:
    """Build a reusable greeting prompt."""
    styles = {
        "friendly": "Please write a warm greeting",
        "formal": "Please write a formal greeting",
        "casual": "Please write a casual greeting",
    }
    return f"{styles.get(style, styles['friendly'])} for {name}."


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

## What each part is doing

### `FastMCP("Demo", json_response=True)`

This creates the server instance and assigns a name. The `json_response=True` setting returns tool output in JSON-friendly form when the return type supports it.

### `@mcp.tool()`

This registers a callable action. Tools are used for computation or tasks that may have side effects.

### `@mcp.resource(...)`

This registers retrievable data. Resources are generally used for read-style access and should avoid heavy side effects.

### `@mcp.prompt()`

This registers a reusable prompt template that a client can request from the server.

### `mcp.run(transport="streamable-http")`

This starts the server using streamable HTTP transport. The MCP Python SDK also supports other transports, including stdio and SSE.

## Add a tool that uses application logic

Most real servers expose tools backed by local code, databases, or APIs. This example registers a task lookup tool:

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Task Server")

TASKS = {
    "deploy": "Deploy the latest application build",
    "backup": "Run the nightly backup workflow",
}


@mcp.tool()
def get_task_description(task_name: str) -> str:
    """Look up a task description by name."""
    return TASKS.get(task_name, "Task not found")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

## Run the server locally

If the file is saved as `server.py`, it can be started with:

```bash
python server.py
```

If the project is managed with `uv`:

```bash
uv run server.py
```

## Test the server during development

The MCP Python SDK documentation points to the MCP Inspector for local testing. A common development workflow is:

1. start the server locally
2. open the inspector
3. connect to the server endpoint
4. invoke tools and resources interactively

The inspector can be started with:

```bash
npx -y @modelcontextprotocol/inspector
```

Then connect the inspector UI to:

```text
http://localhost:8000/mcp
```

## Common design choices

When building an MCP server in Python, a few implementation choices usually matter early:

- keep tools focused on one action or lookup
- reserve resources for read-oriented data access
- keep prompt templates small and reusable
- isolate external dependencies behind functions or service classes
- choose a transport that matches the client environment

## Notes

- `mcp[cli]` installs the Python SDK plus CLI support
- `FastMCP` is the main high-level interface for defining Python MCP servers
- typed function signatures help the SDK generate schemas for tools and resources
- the server can be expanded later with context handling, progress updates, and lifespan-managed dependencies
