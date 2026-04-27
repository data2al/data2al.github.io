---
layout: post
title: "Load and Unload Data With Snowflake Stages and COPY"
categories: [Data Engineering Lab]
tags: Snowflake COPY Stages File-Formats Loading Unloading
author: Alan
summary: "A runnable lab for creating sample data, unloading it to an internal stage, loading it back with COPY INTO, validating load history, and cleaning up."
level: Intermediate
permalink: /data-engineering-lab/load-and-unload-data-with-snowflake-stages-and-copy/
---

* content
{:toc}

Bulk loading and unloading are core Snowflake data engineering skills. This lab uses only SQL, so you do not need a local file. You will create sample rows, unload them to an internal stage, load them into a new table, validate the results, and inspect load metadata.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS COPY_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS COPY_LAB_DB;
CREATE SCHEMA IF NOT EXISTS COPY_LAB_DB.RAW;
CREATE SCHEMA IF NOT EXISTS COPY_LAB_DB.STAGE_AREA;

USE WAREHOUSE COPY_LAB_WH;
USE DATABASE COPY_LAB_DB;
USE SCHEMA RAW;
```

## Step 2: Create sample source data

```sql
CREATE OR REPLACE TABLE RAW.SOURCE_ORDERS (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  REGION STRING,
  PRODUCT_NAME STRING,
  QUANTITY NUMBER,
  UNIT_PRICE NUMBER(10, 2)
);

INSERT INTO RAW.SOURCE_ORDERS
SELECT * FROM VALUES
  (1, 101, '2026-04-01'::DATE, 'East',  'Keyboard', 2,  89.99),
  (2, 102, '2026-04-01'::DATE, 'West',  'Monitor',  1, 249.50),
  (3, 103, '2026-04-02'::DATE, 'South', 'Mouse',    3,  24.25),
  (4, 101, '2026-04-02'::DATE, 'East',  'Dock',     1, 179.00),
  (5, 104, '2026-04-03'::DATE, 'North', 'Headset',  2,  64.75)
AS v (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  REGION,
  PRODUCT_NAME,
  QUANTITY,
  UNIT_PRICE
);

SELECT * FROM RAW.SOURCE_ORDERS ORDER BY ORDER_ID;
```

## Step 3: Create file formats and an internal stage

```sql
USE SCHEMA STAGE_AREA;

CREATE OR REPLACE FILE FORMAT CSV_NO_HEADER_FORMAT
  TYPE = CSV
  FIELD_DELIMITER = ','
  FIELD_OPTIONALLY_ENCLOSED_BY = '"'
  NULL_IF = ('NULL', 'null')
  EMPTY_FIELD_AS_NULL = TRUE
  COMPRESSION = NONE;

CREATE OR REPLACE STAGE ORDERS_INTERNAL_STAGE
  FILE_FORMAT = CSV_NO_HEADER_FORMAT;
```

## Step 4: Unload table data to the stage

`COPY INTO @stage` writes query results to staged files. This is the same pattern you use when exporting curated data for downstream systems.

```sql
COPY INTO @STAGE_AREA.ORDERS_INTERNAL_STAGE/orders_export/orders
FROM (
  SELECT
    ORDER_ID,
    CUSTOMER_ID,
    ORDER_DATE,
    REGION,
    PRODUCT_NAME,
    QUANTITY,
    UNIT_PRICE
  FROM RAW.SOURCE_ORDERS
  ORDER BY ORDER_ID
)
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.CSV_NO_HEADER_FORMAT)
OVERWRITE = TRUE
SINGLE = TRUE;

LIST @STAGE_AREA.ORDERS_INTERNAL_STAGE/orders_export;
```

## Step 5: Load the staged file into a new table

```sql
USE SCHEMA RAW;

CREATE OR REPLACE TABLE RAW.LOADED_ORDERS (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  REGION STRING,
  PRODUCT_NAME STRING,
  QUANTITY NUMBER,
  UNIT_PRICE NUMBER(10, 2)
);

COPY INTO RAW.LOADED_ORDERS
FROM @STAGE_AREA.ORDERS_INTERNAL_STAGE/orders_export
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.CSV_NO_HEADER_FORMAT)
ON_ERROR = 'ABORT_STATEMENT';
```

## Step 6: Validate the load

```sql
SELECT COUNT(*) AS SOURCE_ROW_COUNT
FROM RAW.SOURCE_ORDERS;

SELECT COUNT(*) AS LOADED_ROW_COUNT
FROM RAW.LOADED_ORDERS;

SELECT *
FROM RAW.LOADED_ORDERS
ORDER BY ORDER_ID;

SELECT
  SUM(QUANTITY * UNIT_PRICE) AS LOADED_REVENUE
FROM RAW.LOADED_ORDERS;
```

Expected row count: `5`.

Expected loaded revenue: `874.70`.

## Step 7: Inspect load history

```sql
SELECT
  TABLE_NAME,
  FILE_NAME,
  STATUS,
  ROW_COUNT,
  ERROR_COUNT,
  LAST_LOAD_TIME
FROM TABLE(
  INFORMATION_SCHEMA.LOAD_HISTORY(
    TABLE_NAME => 'LOADED_ORDERS',
    START_TIME => DATEADD(hour, -2, CURRENT_TIMESTAMP())
  )
)
ORDER BY LAST_LOAD_TIME DESC;
```

## Step 8: Practice a validation mode

Use `VALIDATION_MODE` when you want to test a load before writing data.

```sql
TRUNCATE TABLE RAW.LOADED_ORDERS;

COPY INTO RAW.LOADED_ORDERS
FROM @STAGE_AREA.ORDERS_INTERNAL_STAGE/orders_export
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.CSV_NO_HEADER_FORMAT)
VALIDATION_MODE = RETURN_ALL_ERRORS;

SELECT COUNT(*) AS ROWS_AFTER_VALIDATION_MODE
FROM RAW.LOADED_ORDERS;
```

The count should be `0` because validation mode checks the file without loading it.

Load the rows again after validation.

```sql
COPY INTO RAW.LOADED_ORDERS
FROM @STAGE_AREA.ORDERS_INTERNAL_STAGE/orders_export
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.CSV_NO_HEADER_FORMAT)
ON_ERROR = 'ABORT_STATEMENT';
```

## Step 9: Clean up

```sql
DROP DATABASE IF EXISTS COPY_LAB_DB;
DROP WAREHOUSE IF EXISTS COPY_LAB_WH;
```

## Operational focus

For Snowflake data engineering work, know when to use:

- stages for file landing zones
- file formats for parsing rules
- `COPY INTO <table>` for loading
- `COPY INTO @stage` for unloading
- `ON_ERROR` and `VALIDATION_MODE` for operational safety
- `LOAD_HISTORY` for troubleshooting
