---
layout: post
title: "Data Cleanup Before Loading"
categories: Programming
tags: Python Pandas ETL
author: Alan
summary: "A lightweight dataframe cleanup pattern for standardizing files before loading them into a warehouse."
level: Beginner
---

* content
{:toc}

This is a practical preprocessing step for raw CSV data before you pass it into an ETL or ELT workflow.

## Example

```python
import pandas as pd

df = pd.read_csv("input/customers.csv")
df.columns = [column.strip().lower().replace(" ", "_") for column in df.columns]
df = df.drop_duplicates(subset=["customer_id"])
df["updated_at"] = pd.to_datetime(df["updated_at"], utc=True)
```

## What this does

- normalizes column names
- removes duplicate business keys
- converts timestamps into a predictable format

## Notes

- expand the cleanup rules when source systems have inconsistent types
- keep column normalization rules stable across pipelines
- log dropped duplicates when the volume matters operationally
