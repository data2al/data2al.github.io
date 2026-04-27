---
layout: post
title: "Tune Pruning, Clustering, and Search Optimization"
categories: [Data Engineering Lab]
tags: Snowflake Performance Clustering Pruning Search-Optimization
author: Alan
summary: "A performance lab for creating data, testing selective filters, clustering by access pattern, checking clustering metadata, and recognizing search optimization use cases."
level: Advanced
permalink: /data-engineering-lab/tune-pruning-clustering-and-search-optimization/
---

* content
{:toc}

Snowflake performance questions often test micro-partition pruning, clustering keys, query profile interpretation, and when search optimization is worth the cost. This lab creates data and walks through the syntax.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS PERF_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS PERF_LAB_DB;
CREATE SCHEMA IF NOT EXISTS PERF_LAB_DB.MART;

USE WAREHOUSE PERF_LAB_WH;
USE DATABASE PERF_LAB_DB;
USE SCHEMA MART;
```

## Step 2: Create sample fact data

```sql
CREATE OR REPLACE TABLE MART.SALES_FACT AS
SELECT
  SEQ4() + 1 AS SALE_ID,
  DATEADD(day, -UNIFORM(0, 365, RANDOM()), CURRENT_DATE()) AS SALE_DATE,
  UNIFORM(1, 10000, RANDOM()) AS CUSTOMER_ID,
  CASE MOD(SEQ4(), 5)
    WHEN 0 THEN 'East'
    WHEN 1 THEN 'West'
    WHEN 2 THEN 'North'
    WHEN 3 THEN 'South'
    ELSE 'Central'
  END AS REGION,
  'SKU-' || LPAD(UNIFORM(1, 5000, RANDOM())::STRING, 5, '0') AS SKU,
  UNIFORM(10, 1000, RANDOM())::NUMBER(10, 2) AS NET_SALES
FROM TABLE(GENERATOR(ROWCOUNT => 100000));
```

## Step 3: Run selective queries

```sql
SELECT
  SALE_DATE,
  SUM(NET_SALES) AS NET_SALES
FROM MART.SALES_FACT
WHERE SALE_DATE >= DATEADD(day, -7, CURRENT_DATE())
GROUP BY SALE_DATE
ORDER BY SALE_DATE;

SELECT *
FROM MART.SALES_FACT
WHERE CUSTOMER_ID = 42
ORDER BY SALE_DATE DESC;
```

Use the Snowflake query profile in the UI to inspect partitions scanned, bytes scanned, and pruning behavior.

## Step 4: Check clustering metadata

```sql
SELECT SYSTEM$CLUSTERING_INFORMATION(
  'MART.SALES_FACT',
  '(SALE_DATE)'
) AS CLUSTERING_BY_DATE;
```

## Step 5: Add a clustering key

Clustering is most useful for large tables with repeated filters on columns that do not naturally prune well.

```sql
ALTER TABLE MART.SALES_FACT CLUSTER BY (SALE_DATE);

SHOW TABLES LIKE 'SALES_FACT' IN SCHEMA MART;

SELECT SYSTEM$CLUSTERING_INFORMATION(
  'MART.SALES_FACT',
  '(SALE_DATE)'
) AS CLUSTERING_BY_DATE_AFTER_KEY;
```

## Step 6: Practice reclustering syntax

Snowflake manages automatic clustering when enabled for the table. These commands help you recognize how to suspend or resume it.

```sql
ALTER TABLE MART.SALES_FACT SUSPEND RECLUSTER;
ALTER TABLE MART.SALES_FACT RESUME RECLUSTER;
```

## Step 7: Recognize search optimization syntax

Search optimization can help point lookup and selective search patterns, especially on large tables. It is an Enterprise Edition feature and may add cost, so run this only in an account where the feature is available.

```sql
ALTER TABLE MART.SALES_FACT
  ADD SEARCH OPTIMIZATION ON EQUALITY(CUSTOMER_ID, SKU);

SHOW TABLES LIKE 'SALES_FACT' IN SCHEMA MART;

-- Optional cleanup for the feature.
ALTER TABLE MART.SALES_FACT
  DROP SEARCH OPTIMIZATION;
```

## Step 8: Compare with materialized view syntax

Materialized views can help repeated aggregate queries when the maintenance cost is justified.

```sql
CREATE OR REPLACE MATERIALIZED VIEW MART.SALES_BY_DAY_MV AS
SELECT
  SALE_DATE,
  REGION,
  SUM(NET_SALES) AS NET_SALES
FROM MART.SALES_FACT
GROUP BY SALE_DATE, REGION;

SELECT *
FROM MART.SALES_BY_DAY_MV
WHERE SALE_DATE >= DATEADD(day, -7, CURRENT_DATE())
ORDER BY SALE_DATE, REGION;
```

## Step 9: Clean up

```sql
DROP DATABASE IF EXISTS PERF_LAB_DB;
DROP WAREHOUSE IF EXISTS PERF_LAB_WH;
```

## Certification focus

Know that micro-partition pruning is automatic, clustering can improve pruning for large tables with useful filter patterns, search optimization targets selective lookups, and materialized views trade maintenance cost for repeated-query speed.
