---
layout: post
title: "Operate Snowflake Pipelines With Contracts, Observability, and Recovery"
categories: Snowflake
tags: Snowflake Pipelines Observability Recovery Data-Contracts Best-Practices
author: Alan
summary: "A practical operating model for Snowflake pipelines that treats contracts, run visibility, and recovery paths as first-class engineering work."
level: Advanced
permalink: /snowflake-playbooks/operate-snowflake-pipelines-with-contracts-observability-and-recovery/
---

* content
{:toc}

Reliable Snowflake pipelines are not just a chain of `COPY`, `MERGE`, and task statements. They are operational systems. The difference between a useful warehouse and a fragile one is usually not the cleverness of the SQL; it is whether the pipeline has clear contracts, observable runs, and a recovery path when something fails.

This is the standard I like to design toward.

## Start with a contract

Every production pipeline should make its expectations visible before data reaches the business-facing layer.

A useful contract includes:

- source system and owner
- expected delivery cadence
- primary or natural keys
- required columns
- accepted freshness window
- duplicate handling rule
- null handling rule
- downstream consumers

In Snowflake, the contract can be represented through a mix of table comments, tags, quality checks, and documentation. The important part is that the expectations are explicit enough for another engineer to operate the pipeline without guessing.

## Separate landing, validation, and serving

Avoid blending raw ingestion, validation, and curated business logic into one object. A healthier pattern is:

```text
RAW      - source-shaped landing tables
STAGING  - typed, normalized, validated records
MART     - business-facing tables and views
OPS      - run logs, audit checks, and exception records
```

That structure makes failures easier to isolate. If a source file is malformed, the issue belongs near `RAW`. If a join rule changes, the issue belongs near `MART`. If a pipeline run fails, evidence belongs in `OPS`.

## Log pipeline runs like products

Snowflake already gives you query history, load history, and task history. Those are necessary, but I still like a small pipeline-run table because it describes the workflow in the language of the data product.

Example:

```sql
CREATE TABLE IF NOT EXISTS OPS.PIPELINE_RUN_LOG (
  PIPELINE_NAME STRING,
  RUN_ID STRING,
  STATUS STRING,
  STARTED_AT TIMESTAMP_NTZ,
  FINISHED_AT TIMESTAMP_NTZ,
  SOURCE_ROW_COUNT NUMBER,
  TARGET_ROW_COUNT NUMBER,
  ERROR_MESSAGE STRING
);
```

The goal is not to duplicate every Snowflake metadata view. The goal is to make operational review fast:

- Did the customer pipeline run?
- How many rows arrived?
- How many rows survived validation?
- What failed?
- Was the failure in the source, transform, or publish step?

## Build quality checks near the data

Quality checks should be small, specific, and tied to the pipeline contract.

Good checks include:

- required key is not null
- business key is unique in the current batch
- event timestamp is within an accepted range
- fact rows join to required dimensions
- row counts stay inside an expected tolerance
- late-arriving records are tracked instead of silently discarded

Example:

```sql
SELECT
  COUNT(*) AS BAD_ROWS
FROM STAGING.CUSTOMER_EVENTS
WHERE CUSTOMER_ID IS NULL
   OR EVENT_TS IS NULL;
```

The professional habit is to decide what happens when a check fails. A check that nobody acts on becomes decoration.

## Design recovery before the first incident

Recovery should be part of the design, not something invented during an outage.

Common Snowflake recovery questions:

- Can the pipeline rerun safely for the same date or batch?
- Is the load idempotent?
- Do tasks consume streams in a way that preserves unprocessed changes?
- Can a bad batch be quarantined?
- Is there a clean backfill path?
- Can the serving table be rebuilt from trusted upstream layers?

For many Snowflake pipelines, `MERGE` is the backbone of recovery because it supports repeatable upserts by business key.

```sql
MERGE INTO MART.CUSTOMER_FACT AS tgt
USING STAGING.CUSTOMER_DELTA AS src
  ON tgt.CUSTOMER_ID = src.CUSTOMER_ID
WHEN MATCHED THEN UPDATE SET
  tgt.CUSTOMER_NAME = src.CUSTOMER_NAME,
  tgt.UPDATED_AT = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  CUSTOMER_ID,
  CUSTOMER_NAME,
  UPDATED_AT
)
VALUES (
  src.CUSTOMER_ID,
  src.CUSTOMER_NAME,
  CURRENT_TIMESTAMP()
);
```

## Use Snowflake metadata deliberately

Operational reviews should combine your pipeline log with Snowflake's native metadata.

Useful sources:

- `INFORMATION_SCHEMA.LOAD_HISTORY`
- `INFORMATION_SCHEMA.TASK_HISTORY`
- `SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY`
- `SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY`
- `SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY`

Use `INFORMATION_SCHEMA` when you need recent detail quickly. Use `ACCOUNT_USAGE` when you need account-wide reporting and can tolerate lag.

## Final direction

A strong Snowflake pipeline is not just technically correct. It is explainable, recoverable, and observable. That is the platform-engineering bar: the next person should be able to understand what the pipeline expects, what it did last night, what broke, and how to recover without reverse-engineering the whole system from scratch.
