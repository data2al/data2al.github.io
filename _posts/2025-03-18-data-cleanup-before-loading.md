---
layout: post
title: "Clean Source Files Before Loading into Snowflake"
categories: Snowflake
tags: Python Pandas Snowflake Ingestion
author: Alan
summary: "A lightweight dataframe cleanup pattern for standardizing raw files before they land in Snowflake."
level: Beginner
---

* content
{:toc}

Source files often arrive with inconsistent column names, duplicate business keys, and timestamps in mixed formats. A small cleanup layer before the load step prevents a lot of downstream rework in Snowflake.

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

## Why it matters

After cleanup, the dataset is easier to land in a Snowflake staging table because:

- the schema is easier to reason about
- load failures become easier to debug
- downstream models do not need to correct avoidable raw-file issues

## Notes

- expand the cleanup rules when source systems have inconsistent types
- keep normalization rules stable across pipelines
- log dropped duplicates when the volume matters operationally
- separate raw-file cleanup from business-rule transformations
