---
layout: post
title: "Build Reusable Databricks Notebook Utilities in Python"
categories: Databricks
tags: Databricks Python Notebooks Utilities Automation
author: Alan
summary: "A practical pattern for packaging reusable Python helpers that Databricks notebooks and jobs can share instead of duplicating logic cell by cell."
level: Intermediate
---

* content
{:toc}

One of the easiest ways for a Databricks workspace to become hard to maintain is letting every notebook carry its own copy of validation logic, path handling, API calls, and cleanup functions. A better pattern is to move common logic into small Python utilities that notebooks and jobs can import consistently.

## Example utility module

```python
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

REQUIRED_COLUMNS = {"customer_id", "event_ts", "amount"}


def normalize_columns(df: DataFrame) -> DataFrame:
    renamed = df
    for column in df.columns:
        clean_name = column.strip().lower().replace(" ", "_")
        renamed = renamed.withColumnRenamed(column, clean_name)
    return renamed


def validate_required_columns(df: DataFrame) -> None:
    missing = REQUIRED_COLUMNS.difference(set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")


def drop_blank_customer_ids(df: DataFrame) -> DataFrame:
    return df.filter(F.col("customer_id").isNotNull())
```

## Use the utility from a notebook

```python
from project_utils.ingestion import (
    drop_blank_customer_ids,
    normalize_columns,
    validate_required_columns,
)

df = spark.read.option("header", True).csv("/Volumes/raw/customers.csv")
df = normalize_columns(df)
validate_required_columns(df)
df = drop_blank_customer_ids(df)
```

## Why this helps

- the notebook stays focused on business logic
- repeated ingestion rules live in one place
- fixes can be rolled into multiple jobs more easily
- teams stop copy-pasting helper cells across notebooks

## Good candidates for shared utilities

- schema validation
- retry-safe API wrappers
- path conventions for volumes and checkpoints
- lightweight quality checks before writes
- configuration loading for jobs and notebook tasks

## Notes

- keep shared modules small and readable
- avoid hiding core transformation logic behind too much abstraction
- version utility code with the same discipline as production jobs
- prefer explicit imports over one giant helper file
