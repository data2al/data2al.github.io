---
layout: post
title: "Measure Warehouse Cost and Query Performance"
categories: [Data Engineering Lab]
tags: Snowflake Warehouses Cost Query-History Performance
author: Alan
summary: "A lab for creating workload data, running queries, inspecting query history, estimating warehouse cost, and understanding compute sizing tradeoffs."
level: Intermediate
permalink: /data-engineering-lab/measure-warehouse-cost-and-query-performance/
---

* content
{:toc}

Snowflake data engineering exams often ask you to choose warehouse sizes, isolate workloads, and diagnose cost or performance issues. This lab creates a small workload and gives you the monitoring queries to inspect it.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS COST_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS COST_LAB_DB;
CREATE SCHEMA IF NOT EXISTS COST_LAB_DB.MART;

USE WAREHOUSE COST_LAB_WH;
USE DATABASE COST_LAB_DB;
USE SCHEMA MART;
```

## Step 2: Create sample workload data

```sql
CREATE OR REPLACE TABLE MART.ORDER_EVENTS AS
SELECT
  SEQ4() + 1 AS EVENT_ID,
  UNIFORM(1, 500, RANDOM()) AS CUSTOMER_ID,
  DATEADD(day, -UNIFORM(0, 30, RANDOM()), CURRENT_DATE()) AS ORDER_DATE,
  CASE MOD(SEQ4(), 4)
    WHEN 0 THEN 'East'
    WHEN 1 THEN 'West'
    WHEN 2 THEN 'North'
    ELSE 'South'
  END AS REGION,
  UNIFORM(10, 500, RANDOM())::NUMBER(10, 2) AS NET_SALES
FROM TABLE(GENERATOR(ROWCOUNT => 20000));
```

## Step 3: Run a few workload queries

```sql
SELECT
  REGION,
  COUNT(*) AS ORDER_COUNT,
  SUM(NET_SALES) AS NET_SALES
FROM MART.ORDER_EVENTS
GROUP BY REGION
ORDER BY NET_SALES DESC;

SELECT
  CUSTOMER_ID,
  SUM(NET_SALES) AS CUSTOMER_SALES
FROM MART.ORDER_EVENTS
GROUP BY CUSTOMER_ID
QUALIFY ROW_NUMBER() OVER (ORDER BY SUM(NET_SALES) DESC) <= 10;

SELECT
  ORDER_DATE,
  REGION,
  SUM(NET_SALES) AS DAILY_SALES
FROM MART.ORDER_EVENTS
GROUP BY ORDER_DATE, REGION
ORDER BY ORDER_DATE, REGION;
```

## Step 4: Inspect recent query history

```sql
SELECT
  QUERY_ID,
  QUERY_TEXT,
  WAREHOUSE_NAME,
  EXECUTION_STATUS,
  TOTAL_ELAPSED_TIME / 1000 AS ELAPSED_SECONDS,
  BYTES_SCANNED,
  ROWS_PRODUCED,
  START_TIME
FROM TABLE(
  INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(
    WAREHOUSE_NAME => 'COST_LAB_WH',
    END_TIME_RANGE_START => DATEADD(hour, -2, CURRENT_TIMESTAMP()),
    RESULT_LIMIT => 20
  )
)
ORDER BY START_TIME DESC;
```

## Step 5: Inspect warehouse metering

`ACCOUNT_USAGE` can lag, so this is best for historical reporting rather than immediate troubleshooting.

```sql
SELECT
  WAREHOUSE_NAME,
  START_TIME,
  END_TIME,
  CREDITS_USED,
  CREDITS_USED_COMPUTE,
  CREDITS_USED_CLOUD_SERVICES
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE WAREHOUSE_NAME = 'COST_LAB_WH'
  AND START_TIME >= DATEADD(day, -1, CURRENT_TIMESTAMP())
ORDER BY START_TIME DESC;
```

## Step 6: Estimate query cost by time share

This simple estimate allocates hourly warehouse credits by each query's share of elapsed time. It is not perfect, but it is useful for FinOps conversations.

```sql
WITH query_seconds AS (
  SELECT
    QUERY_ID,
    START_TIME,
    TOTAL_ELAPSED_TIME / 1000 AS ELAPSED_SECONDS,
    DATE_TRUNC(hour, START_TIME) AS USAGE_HOUR
  FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
  WHERE WAREHOUSE_NAME = 'COST_LAB_WH'
    AND START_TIME >= DATEADD(day, -1, CURRENT_TIMESTAMP())
),
hourly_credits AS (
  SELECT
    DATE_TRUNC(hour, START_TIME) AS USAGE_HOUR,
    SUM(CREDITS_USED_COMPUTE) AS CREDITS_USED_COMPUTE
  FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
  WHERE WAREHOUSE_NAME = 'COST_LAB_WH'
    AND START_TIME >= DATEADD(day, -1, CURRENT_TIMESTAMP())
  GROUP BY 1
),
hourly_query_seconds AS (
  SELECT
    USAGE_HOUR,
    SUM(ELAPSED_SECONDS) AS TOTAL_QUERY_SECONDS
  FROM query_seconds
  GROUP BY 1
)
SELECT
  q.QUERY_ID,
  q.ELAPSED_SECONDS,
  h.CREDITS_USED_COMPUTE,
  q.ELAPSED_SECONDS / NULLIF(s.TOTAL_QUERY_SECONDS, 0) * h.CREDITS_USED_COMPUTE AS ESTIMATED_QUERY_CREDITS
FROM query_seconds AS q
JOIN hourly_query_seconds AS s
  ON q.USAGE_HOUR = s.USAGE_HOUR
JOIN hourly_credits AS h
  ON q.USAGE_HOUR = h.USAGE_HOUR
ORDER BY ESTIMATED_QUERY_CREDITS DESC;
```

## Step 7: Practice warehouse changes

```sql
ALTER WAREHOUSE COST_LAB_WH SET WAREHOUSE_SIZE = SMALL;
ALTER WAREHOUSE COST_LAB_WH SET AUTO_SUSPEND = 120;
ALTER WAREHOUSE COST_LAB_WH SET WAREHOUSE_SIZE = XSMALL;
ALTER WAREHOUSE COST_LAB_WH SUSPEND;
```

## Step 8: Clean up

```sql
DROP DATABASE IF EXISTS COST_LAB_DB;
DROP WAREHOUSE IF EXISTS COST_LAB_WH;
```

## Certification focus

Know how auto-suspend, warehouse size, workload isolation, query history, and warehouse metering work together. For immediate troubleshooting, prefer `INFORMATION_SCHEMA`; for cost reporting, expect `ACCOUNT_USAGE`.
