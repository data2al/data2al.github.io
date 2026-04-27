---
layout: post
title: "Build Managed Transformations With Dynamic Tables"
categories: [Data Engineering Lab]
tags: Snowflake Dynamic-Tables Transformation Pipelines Monitoring
author: Alan
summary: "A runnable lab for creating sample source tables, building dynamic tables, refreshing them, checking results, and monitoring refresh history."
level: Intermediate
permalink: /data-engineering-lab/build-managed-transformations-with-dynamic-tables/
---

* content
{:toc}

Dynamic tables are Snowflake-managed transformation objects. Instead of writing every refresh step as a task, you define the query and target freshness. Snowflake manages refresh planning for the dynamic table.

This lab creates source data, builds two dynamic tables, refreshes them, validates output, and inspects refresh history.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS DYNAMIC_TABLE_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS DYNAMIC_TABLE_LAB_DB;
CREATE SCHEMA IF NOT EXISTS DYNAMIC_TABLE_LAB_DB.RAW;
CREATE SCHEMA IF NOT EXISTS DYNAMIC_TABLE_LAB_DB.MART;

USE WAREHOUSE DYNAMIC_TABLE_LAB_WH;
USE DATABASE DYNAMIC_TABLE_LAB_DB;
USE SCHEMA RAW;
```

## Step 2: Create sample source tables

```sql
CREATE OR REPLACE TABLE RAW.ORDERS (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  ORDER_STATUS STRING,
  NET_SALES NUMBER(10, 2)
);

CREATE OR REPLACE TABLE RAW.CUSTOMERS (
  CUSTOMER_ID NUMBER,
  CUSTOMER_NAME STRING,
  REGION STRING,
  CUSTOMER_TIER STRING
);

INSERT INTO RAW.ORDERS
SELECT * FROM VALUES
  (1, 101, '2026-04-01'::DATE, 'COMPLETE', 120.00),
  (2, 102, '2026-04-01'::DATE, 'COMPLETE',  80.50),
  (3, 101, '2026-04-02'::DATE, 'RETURNED',  45.00),
  (4, 103, '2026-04-02'::DATE, 'COMPLETE', 220.10),
  (5, 104, '2026-04-03'::DATE, 'COMPLETE',  35.75)
AS v (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  ORDER_STATUS,
  NET_SALES
);

INSERT INTO RAW.CUSTOMERS
SELECT * FROM VALUES
  (101, 'Apex Supply',   'East',  'Gold'),
  (102, 'Northwind Co',  'West',  'Silver'),
  (103, 'Summit Retail', 'South', 'Gold'),
  (104, 'Metro Goods',   'North', 'Bronze')
AS v (
  CUSTOMER_ID,
  CUSTOMER_NAME,
  REGION,
  CUSTOMER_TIER
);
```

## Step 3: Create a cleaned order dynamic table

```sql
USE SCHEMA MART;

CREATE OR REPLACE DYNAMIC TABLE MART.CLEAN_ORDER_DT
  TARGET_LAG = '5 minutes'
  WAREHOUSE = DYNAMIC_TABLE_LAB_WH
AS
SELECT
  o.ORDER_ID,
  o.CUSTOMER_ID,
  c.CUSTOMER_NAME,
  c.REGION,
  c.CUSTOMER_TIER,
  o.ORDER_DATE,
  o.ORDER_STATUS,
  IFF(o.ORDER_STATUS = 'COMPLETE', o.NET_SALES, 0) AS RECOGNIZED_SALES
FROM RAW.ORDERS AS o
JOIN RAW.CUSTOMERS AS c
  ON o.CUSTOMER_ID = c.CUSTOMER_ID;
```

## Step 4: Create an aggregate dynamic table

```sql
CREATE OR REPLACE DYNAMIC TABLE MART.REGION_DAILY_SALES_DT
  TARGET_LAG = '5 minutes'
  WAREHOUSE = DYNAMIC_TABLE_LAB_WH
AS
SELECT
  REGION,
  ORDER_DATE,
  SUM(RECOGNIZED_SALES) AS RECOGNIZED_SALES,
  COUNT(*) AS ORDER_COUNT
FROM MART.CLEAN_ORDER_DT
GROUP BY
  REGION,
  ORDER_DATE;
```

## Step 5: Refresh and query the dynamic tables

Dynamic tables refresh automatically, but manual refresh is useful for demos and validation.

```sql
ALTER DYNAMIC TABLE MART.CLEAN_ORDER_DT REFRESH;
ALTER DYNAMIC TABLE MART.REGION_DAILY_SALES_DT REFRESH;

SELECT *
FROM MART.CLEAN_ORDER_DT
ORDER BY ORDER_ID;

SELECT *
FROM MART.REGION_DAILY_SALES_DT
ORDER BY ORDER_DATE, REGION;
```

Expected recognized sales by region:

| REGION | RECOGNIZED_SALES |
|---|---:|
| East | 120.00 |
| North | 35.75 |
| South | 220.10 |
| West | 80.50 |

## Step 6: Add source data and refresh again

```sql
INSERT INTO RAW.ORDERS
SELECT * FROM VALUES
  (6, 101, '2026-04-03'::DATE, 'COMPLETE', 310.00),
  (7, 102, '2026-04-04'::DATE, 'COMPLETE',  55.25)
AS v (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  ORDER_STATUS,
  NET_SALES
);

ALTER DYNAMIC TABLE MART.CLEAN_ORDER_DT REFRESH;
ALTER DYNAMIC TABLE MART.REGION_DAILY_SALES_DT REFRESH;

SELECT
  REGION,
  SUM(RECOGNIZED_SALES) AS RECOGNIZED_SALES
FROM MART.REGION_DAILY_SALES_DT
GROUP BY REGION
ORDER BY REGION;
```

After the new rows, East should increase to `430.00` and West should increase to `135.75`.

## Step 7: Inspect dynamic table definitions

```sql
SHOW DYNAMIC TABLES IN SCHEMA MART;

DESCRIBE DYNAMIC TABLE MART.CLEAN_ORDER_DT;
DESCRIBE DYNAMIC TABLE MART.REGION_DAILY_SALES_DT;
```

## Step 8: Monitor refresh history

```sql
SELECT
  NAME,
  STATE,
  STATE_CODE,
  STATE_MESSAGE,
  REFRESH_START_TIME,
  REFRESH_END_TIME,
  REFRESH_ACTION
FROM TABLE(
  INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY(
    NAME_PREFIX => 'DYNAMIC_TABLE_LAB_DB.MART.',
    DATA_TIMESTAMP_START => DATEADD(hour, -2, CURRENT_TIMESTAMP()),
    RESULT_LIMIT => 100
  )
)
ORDER BY REFRESH_START_TIME DESC;
```

If your account uses `ACCOUNT_USAGE` for longer reporting, dynamic table refresh metadata is also available there, but it may lag.

## Step 9: Suspend or resume refresh

Use suspend when you want to stop managed refresh during maintenance.

```sql
ALTER DYNAMIC TABLE MART.REGION_DAILY_SALES_DT SUSPEND;
ALTER DYNAMIC TABLE MART.CLEAN_ORDER_DT SUSPEND;

ALTER DYNAMIC TABLE MART.CLEAN_ORDER_DT RESUME;
ALTER DYNAMIC TABLE MART.REGION_DAILY_SALES_DT RESUME;
```

## Step 10: Clean up

```sql
DROP DATABASE IF EXISTS DYNAMIC_TABLE_LAB_DB;
DROP WAREHOUSE IF EXISTS DYNAMIC_TABLE_LAB_WH;
```

## Certification focus

For the data engineering exam, know:

- dynamic tables maintain query results according to target lag
- tasks give explicit orchestration control, while dynamic tables manage refresh
- downstream dynamic tables can depend on upstream dynamic tables
- manual refresh is useful for validation
- refresh history helps troubleshoot failed or delayed refreshes
