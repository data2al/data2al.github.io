---
layout: post
title: "Call Databricks Jobs from a Python Service"
categories: Databricks
tags: Databricks Python Jobs Services Automation APIs
author: Alan
summary: "A practical example of triggering Databricks jobs from a Python service so notebook workflows can plug into larger engineering systems."
level: Intermediate
---

* content
{:toc}

Databricks jobs are often only one part of a larger delivery flow. A Python service may still need to receive a request, validate inputs, trigger a notebook or workflow, and return a run identifier to the caller.

## Install dependencies

```bash
pip install databricks-sdk fastapi uvicorn
```

## Example job trigger

```python
import os

from databricks.sdk import WorkspaceClient


def trigger_job(customer_id: str, job_id: int) -> str:
    client = WorkspaceClient(
        host=os.environ["DATABRICKS_HOST"],
        token=os.environ["DATABRICKS_TOKEN"],
    )

    run = client.jobs.run_now(
        job_id=job_id,
        job_parameters={"customer_id": customer_id},
    )

    return str(run.run_id)
```

## Wrap it in a small API

```python
from fastapi import FastAPI
from databricks.sdk import WorkspaceClient

app = FastAPI()
client = WorkspaceClient()


@app.post("/runs/customer-refresh")
def run_customer_refresh(customer_id: str):
    run = client.jobs.run_now(
        job_id=123456789,
        job_parameters={"customer_id": customer_id},
    )
    return {"run_id": run.run_id}
```

## Why teams use this pattern

- external apps should not need notebook-specific logic
- request validation can happen before cluster work starts
- authentication and auditing are easier to centralize
- one service can route to several jobs without exposing workspace details

## Notes

- keep workspace credentials outside source control
- validate input before starting the run
- return the run id so callers can check status elsewhere
- separate quick API responses from long-running compute
