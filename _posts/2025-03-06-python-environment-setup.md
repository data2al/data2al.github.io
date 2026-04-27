---
layout: post
title: "Set Up a Snowflake Connector in Python"
categories: Snowflake
tags: Python Snowflake Setup Snowpark Connectivity
author: Alan
summary: "A clean starting point for loading environment variables and opening a Snowflake connection from Python."
level: Beginner
---

* content
{:toc}

This is a simple setup pattern for Python scripts that need Snowflake access without hardcoding secrets into source files.

## Example

```python
import os
import snowflake.connector

connection = snowflake.connector.connect(
    account=os.environ["SNOWFLAKE_ACCOUNT"],
    user=os.environ["SNOWFLAKE_USER"],
    password=os.environ["SNOWFLAKE_PASSWORD"],
    warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
    database=os.environ["SNOWFLAKE_DATABASE"],
    schema=os.environ["SNOWFLAKE_SCHEMA"],
)
```

## Why this pattern helps

- secrets stay outside the script
- local development and deployment environments can use the same code
- connection settings are easy to rotate or replace later
- the same setup can support connector-based scripts and Snowpark entry points

## Notes

- keep credentials in environment variables or a secrets manager
- avoid printing connection details in logs
- validate required variables before opening the connection in production code
