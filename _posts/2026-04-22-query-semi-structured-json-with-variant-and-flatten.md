---
layout: post
title: "Query Semi-Structured JSON With VARIANT and FLATTEN"
categories: [Data Engineering Lab]
tags: Snowflake JSON VARIANT FLATTEN Semi-Structured
author: Alan
summary: "A runnable lab for loading JSON into VARIANT columns, extracting attributes, flattening arrays, and building relational outputs."
level: Intermediate
permalink: /data-engineering-lab/query-semi-structured-json-with-variant-and-flatten/
---

* content
{:toc}

Snowflake data engineers often receive JSON from events, APIs, logs, and application exports. This lab creates JSON data directly in SQL, stores it in `VARIANT`, flattens nested arrays, and turns semi-structured records into relational tables.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS JSON_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS JSON_LAB_DB;
CREATE SCHEMA IF NOT EXISTS JSON_LAB_DB.RAW;
CREATE SCHEMA IF NOT EXISTS JSON_LAB_DB.MART;

USE WAREHOUSE JSON_LAB_WH;
USE DATABASE JSON_LAB_DB;
USE SCHEMA RAW;
```

## Step 2: Create a raw event table

```sql
CREATE OR REPLACE TABLE RAW.CLICKSTREAM_EVENTS (
  EVENT_ID NUMBER,
  EVENT_PAYLOAD VARIANT,
  INGESTED_AT TIMESTAMP_NTZ
);
```

## Step 3: Insert sample JSON data

```sql
INSERT INTO RAW.CLICKSTREAM_EVENTS
SELECT
  COLUMN1 AS EVENT_ID,
  PARSE_JSON(COLUMN2) AS EVENT_PAYLOAD,
  CURRENT_TIMESTAMP() AS INGESTED_AT
FROM VALUES
  (
    1,
    '{
      "event_type": "page_view",
      "event_ts": "2026-04-20T09:15:00Z",
      "user": {"id": 501, "plan": "pro", "region": "NA"},
      "page": {"url": "/pricing", "referrer": "search"},
      "items": []
    }'
  ),
  (
    2,
    '{
      "event_type": "cart_update",
      "event_ts": "2026-04-20T09:20:00Z",
      "user": {"id": 502, "plan": "free", "region": "EU"},
      "page": {"url": "/cart", "referrer": "email"},
      "items": [
        {"sku": "KB-100", "qty": 1, "price": 89.99},
        {"sku": "MS-200", "qty": 2, "price": 24.25}
      ]
    }'
  ),
  (
    3,
    '{
      "event_type": "purchase",
      "event_ts": "2026-04-20T09:31:00Z",
      "user": {"id": 501, "plan": "pro", "region": "NA"},
      "page": {"url": "/checkout", "referrer": "direct"},
      "items": [
        {"sku": "MN-300", "qty": 1, "price": 249.50}
      ]
    }'
  );
```

## Step 4: Inspect the raw JSON

```sql
SELECT
  EVENT_ID,
  TYPEOF(EVENT_PAYLOAD) AS PAYLOAD_TYPE,
  EVENT_PAYLOAD
FROM RAW.CLICKSTREAM_EVENTS
ORDER BY EVENT_ID;
```

## Step 5: Extract scalar attributes

Use colon notation to access JSON paths, then cast values into relational types.

```sql
SELECT
  EVENT_ID,
  EVENT_PAYLOAD:event_type::STRING AS EVENT_TYPE,
  EVENT_PAYLOAD:event_ts::TIMESTAMP_NTZ AS EVENT_TS,
  EVENT_PAYLOAD:user.id::NUMBER AS USER_ID,
  EVENT_PAYLOAD:user.plan::STRING AS PLAN_NAME,
  EVENT_PAYLOAD:user.region::STRING AS REGION,
  EVENT_PAYLOAD:page.url::STRING AS PAGE_URL
FROM RAW.CLICKSTREAM_EVENTS
ORDER BY EVENT_ID;
```

## Step 6: Flatten the nested item array

`LATERAL FLATTEN` expands each array element into a row.

```sql
SELECT
  e.EVENT_ID,
  e.EVENT_PAYLOAD:event_type::STRING AS EVENT_TYPE,
  item.value:sku::STRING AS SKU,
  item.value:qty::NUMBER AS QUANTITY,
  item.value:price::NUMBER(10, 2) AS UNIT_PRICE,
  item.value:qty::NUMBER * item.value:price::NUMBER(10, 2) AS LINE_AMOUNT
FROM RAW.CLICKSTREAM_EVENTS AS e,
LATERAL FLATTEN(INPUT => e.EVENT_PAYLOAD:items) AS item
ORDER BY e.EVENT_ID, SKU;
```

Expected item rows: `3`.

## Step 7: Build relational tables from JSON

```sql
USE SCHEMA MART;

CREATE OR REPLACE TABLE MART.EVENT_FACT AS
SELECT
  EVENT_ID,
  EVENT_PAYLOAD:event_type::STRING AS EVENT_TYPE,
  EVENT_PAYLOAD:event_ts::TIMESTAMP_NTZ AS EVENT_TS,
  EVENT_PAYLOAD:user.id::NUMBER AS USER_ID,
  EVENT_PAYLOAD:user.plan::STRING AS PLAN_NAME,
  EVENT_PAYLOAD:user.region::STRING AS REGION,
  EVENT_PAYLOAD:page.url::STRING AS PAGE_URL,
  EVENT_PAYLOAD:page.referrer::STRING AS REFERRER,
  INGESTED_AT
FROM RAW.CLICKSTREAM_EVENTS;

CREATE OR REPLACE TABLE MART.EVENT_ITEM_FACT AS
SELECT
  e.EVENT_ID,
  e.EVENT_PAYLOAD:event_ts::TIMESTAMP_NTZ AS EVENT_TS,
  e.EVENT_PAYLOAD:user.id::NUMBER AS USER_ID,
  item.value:sku::STRING AS SKU,
  item.value:qty::NUMBER AS QUANTITY,
  item.value:price::NUMBER(10, 2) AS UNIT_PRICE,
  item.value:qty::NUMBER * item.value:price::NUMBER(10, 2) AS LINE_AMOUNT
FROM RAW.CLICKSTREAM_EVENTS AS e,
LATERAL FLATTEN(INPUT => e.EVENT_PAYLOAD:items) AS item;
```

## Step 8: Validate the outputs

```sql
SELECT * FROM MART.EVENT_FACT ORDER BY EVENT_ID;
SELECT * FROM MART.EVENT_ITEM_FACT ORDER BY EVENT_ID, SKU;

SELECT
  USER_ID,
  SUM(LINE_AMOUNT) AS ITEM_REVENUE
FROM MART.EVENT_ITEM_FACT
GROUP BY USER_ID
ORDER BY USER_ID;
```

Expected item revenue:

| USER_ID | ITEM_REVENUE |
|---:|---:|
| 501 | 249.50 |
| 502 | 138.49 |

## Step 9: Find malformed or missing fields

Production JSON often changes. These checks help find missing paths before downstream models break.

```sql
SELECT
  EVENT_ID,
  EVENT_PAYLOAD:event_type IS NULL AS MISSING_EVENT_TYPE,
  EVENT_PAYLOAD:user.id IS NULL AS MISSING_USER_ID,
  EVENT_PAYLOAD:items IS NULL AS MISSING_ITEMS_ARRAY
FROM RAW.CLICKSTREAM_EVENTS
ORDER BY EVENT_ID;
```

## Step 10: Clean up

```sql
DROP DATABASE IF EXISTS JSON_LAB_DB;
DROP WAREHOUSE IF EXISTS JSON_LAB_WH;
```

## Certification focus

For the data engineering exam, know:

- when to store source data as `VARIANT`
- how to use `PARSE_JSON`
- how to extract nested fields with colon notation
- when to cast JSON values into typed columns
- how `LATERAL FLATTEN` turns arrays into rows
- how to validate schema drift and missing attributes
