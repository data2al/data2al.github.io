---
layout: post
title: "Practice Snowpipe and Pipe Operations"
categories: [Data Engineering Lab]
tags: Snowflake Snowpipe Pipes COPY Stages Loading
author: Alan
summary: "A runnable lab for creating a pipe definition, staging sample data, practicing COPY validation, inspecting pipe metadata, and understanding auto-ingest exam concepts."
level: Intermediate
permalink: /data-engineering-lab/practice-snowpipe-and-pipe-operations/
---

* content
{:toc}

Snowpipe is Snowflake's continuous file ingestion service. Full auto-ingest requires cloud notification setup, but you can still practice the core objects and the `COPY` statement Snowpipe runs.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS SNOWPIPE_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS SNOWPIPE_LAB_DB;
CREATE SCHEMA IF NOT EXISTS SNOWPIPE_LAB_DB.RAW;
CREATE SCHEMA IF NOT EXISTS SNOWPIPE_LAB_DB.STAGE_AREA;

USE WAREHOUSE SNOWPIPE_LAB_WH;
USE DATABASE SNOWPIPE_LAB_DB;
```

## Step 2: Create sample data and a stage

```sql
CREATE OR REPLACE TABLE RAW.EVENT_SOURCE (
  EVENT_ID NUMBER,
  EVENT_TS TIMESTAMP_NTZ,
  EVENT_TYPE STRING,
  CUSTOMER_ID NUMBER,
  EVENT_AMOUNT NUMBER(10, 2)
);

INSERT INTO RAW.EVENT_SOURCE
SELECT * FROM VALUES
  (1, '2026-04-10 09:00:00'::TIMESTAMP_NTZ, 'page_view', 101, 0.00),
  (2, '2026-04-10 09:02:00'::TIMESTAMP_NTZ, 'purchase', 101, 59.99),
  (3, '2026-04-10 09:05:00'::TIMESTAMP_NTZ, 'purchase', 102, 32.50)
AS v (EVENT_ID, EVENT_TS, EVENT_TYPE, CUSTOMER_ID, EVENT_AMOUNT);

CREATE OR REPLACE FILE FORMAT STAGE_AREA.PIPE_CSV_FORMAT
  TYPE = CSV
  FIELD_DELIMITER = ','
  FIELD_OPTIONALLY_ENCLOSED_BY = '"'
  SKIP_HEADER = 0
  COMPRESSION = NONE;

CREATE OR REPLACE STAGE STAGE_AREA.PIPE_STAGE
  FILE_FORMAT = STAGE_AREA.PIPE_CSV_FORMAT;
```

## Step 3: Unload rows into staged files

```sql
COPY INTO @STAGE_AREA.PIPE_STAGE/events/batch_01
FROM (
  SELECT EVENT_ID, EVENT_TS, EVENT_TYPE, CUSTOMER_ID, EVENT_AMOUNT
  FROM RAW.EVENT_SOURCE
  ORDER BY EVENT_ID
)
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.PIPE_CSV_FORMAT)
OVERWRITE = TRUE
SINGLE = TRUE;

LIST @STAGE_AREA.PIPE_STAGE/events;
```

## Step 4: Create the target table

```sql
CREATE OR REPLACE TABLE RAW.EVENT_LANDING (
  EVENT_ID NUMBER,
  EVENT_TS TIMESTAMP_NTZ,
  EVENT_TYPE STRING,
  CUSTOMER_ID NUMBER,
  EVENT_AMOUNT NUMBER(10, 2),
  LOAD_TS TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

## Step 5: Validate the load statement Snowpipe would run

```sql
COPY INTO RAW.EVENT_LANDING (
  EVENT_ID,
  EVENT_TS,
  EVENT_TYPE,
  CUSTOMER_ID,
  EVENT_AMOUNT
)
FROM @STAGE_AREA.PIPE_STAGE/events
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.PIPE_CSV_FORMAT)
VALIDATION_MODE = RETURN_ALL_ERRORS;
```

If no rows are returned, the staged file is valid.

## Step 6: Create a pipe definition

The pipe stores the `COPY INTO` statement Snowpipe uses when files arrive.

```sql
CREATE OR REPLACE PIPE RAW.EVENT_PIPE
  AUTO_INGEST = FALSE
  COMMENT = 'Demo pipe for Snowpipe certification practice.'
AS
COPY INTO RAW.EVENT_LANDING (
  EVENT_ID,
  EVENT_TS,
  EVENT_TYPE,
  CUSTOMER_ID,
  EVENT_AMOUNT
)
FROM @STAGE_AREA.PIPE_STAGE/events
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.PIPE_CSV_FORMAT)
ON_ERROR = 'SKIP_FILE';

SHOW PIPES LIKE 'EVENT_PIPE' IN SCHEMA RAW;
DESCRIBE PIPE RAW.EVENT_PIPE;
```

## Step 7: Load the data and inspect history

For a fully configured Snowpipe environment, files are loaded through the pipe. In this local worksheet lab, run the same `COPY INTO` statement directly so the validation is runnable without cloud notifications.

```sql
COPY INTO RAW.EVENT_LANDING (
  EVENT_ID,
  EVENT_TS,
  EVENT_TYPE,
  CUSTOMER_ID,
  EVENT_AMOUNT
)
FROM @STAGE_AREA.PIPE_STAGE/events
FILE_FORMAT = (FORMAT_NAME = STAGE_AREA.PIPE_CSV_FORMAT)
ON_ERROR = 'SKIP_FILE';

SELECT *
FROM RAW.EVENT_LANDING
ORDER BY EVENT_ID;

SELECT
  TABLE_NAME,
  FILE_NAME,
  STATUS,
  ROW_COUNT,
  ERROR_COUNT,
  LAST_LOAD_TIME
FROM TABLE(
  INFORMATION_SCHEMA.LOAD_HISTORY(
    TABLE_NAME => 'EVENT_LANDING',
    START_TIME => DATEADD(hour, -2, CURRENT_TIMESTAMP())
  )
)
ORDER BY LAST_LOAD_TIME DESC;
```

## Step 8: Know the auto-ingest shape

This is the cloud-notification pattern to recognize on the exam. Do not run it unless your account has the notification integration configured.

```sql
-- Example shape only.
CREATE OR REPLACE PIPE RAW.EVENT_PIPE_AUTO
  AUTO_INGEST = TRUE
  INTEGRATION = 'MY_NOTIFICATION_INTEGRATION'
AS
COPY INTO RAW.EVENT_LANDING
FROM @MY_EXTERNAL_STAGE/events
FILE_FORMAT = (TYPE = CSV);
```

## Step 9: Clean up

```sql
DROP DATABASE IF EXISTS SNOWPIPE_LAB_DB;
DROP WAREHOUSE IF EXISTS SNOWPIPE_LAB_WH;
```

## Certification focus

Know the difference between bulk `COPY INTO`, a pipe definition, Snowpipe auto-ingest, notification integrations, pipe metadata, load history, and error-handling choices such as `ON_ERROR`.
