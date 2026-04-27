---
layout: post
title: "Serve ML Inference from Databricks and Python Clients"
categories: Databricks
tags: Databricks Machine-Learning Python Model-Serving APIs
author: Alan
summary: "A practical architecture for serving Databricks-hosted models behind a stable API that Python clients can call from downstream applications."
level: Intermediate
---

* content
{:toc}

A practical Databricks ML setup often has three layers:

1. a model layer that performs inference
2. a serving layer that exposes the model in a controlled way
3. a client layer that calls the endpoint from another application

## Simple architecture

```text
Python Client
    |
    v
Internal Service or Direct Caller
    |
    v
Databricks Model Serving Endpoint
    |
    +--> Registered Model Version
```

## Example client call

```python
import os
import requests


def score_text(text: str) -> dict:
    response = requests.post(
        os.environ["DATABRICKS_SERVING_URL"],
        headers={
            "Authorization": f"Bearer {os.environ['DATABRICKS_TOKEN']}",
            "Content-Type": "application/json",
        },
        json={"inputs": [{"text": text}]},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()
```

## Why teams like this pattern

- model lifecycle stays close to the lakehouse platform
- downstream services do not need notebook-specific dependencies
- auth, scaling, and endpoint management are centralized
- the same model can serve notebooks, apps, and batch clients

## Common use cases

- notebook-assisted scoring workflows
- internal applications that need predictions from one trusted model
- batch enrichment jobs that call a serving endpoint
- thin Python services that expose model results downstream

## Notes

- keep the serving contract small and explicit
- return structured JSON so downstream systems do not parse free-form text
- separate endpoint auth from business logic
- use a client wrapper so endpoint details are not scattered across the codebase
