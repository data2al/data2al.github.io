---
layout: post
title: "Create, Schedule, Manage, and Monitor Tasks in Snowflake"
categories: [Data Engineering Lab]
tags: Snowflake Tasks Scheduling Monitoring Data-Engineering
author: Alan
summary: "A runnable Snowflake task walkthrough with sample data, task syntax, scheduling, task graph management, monitoring queries, and cleanup."
level: Intermediate
permalink: /data-engineering-lab/create-schedule-manage-and-monitor-snowflake-tasks/
---

* content
{:toc}

Snowflake tasks let you automate SQL, stored procedures, and Snowflake Scripting on a schedule or in response to upstream data changes. This walkthrough is written as a step-by-step script you can run in a Snowflake worksheet from start to finish.

The demo creates:

- a small warehouse
- a demo database with `RAW`, `MART`, and `OPS` schemas
- sample order data
- a scheduled task that refreshes a daily sales summary
- a stream-triggered task that applies incremental changes
- a small task graph with a root task and child tasks
- monitoring queries for task history and dependencies

## Step 1: Choose a role and create the demo workspace

Use a role that can create a warehouse, database, schemas, tables, streams, and tasks. The role also needs `EXECUTE TASK` on the account. In many demo environments, `ACCOUNTADMIN` works. In production, use a dedicated owner role instead.

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS TASK_DEMO_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS TASK_DEMO_DB;
CREATE SCHEMA IF NOT EXISTS TASK_DEMO_DB.RAW;
CREATE SCHEMA IF NOT EXISTS TASK_DEMO_DB.MART;
CREATE SCHEMA IF NOT EXISTS TASK_DEMO_DB.OPS;

USE WAREHOUSE TASK_DEMO_WH;
USE DATABASE TASK_DEMO_DB;
USE SCHEMA RAW;
```

If you are using a custom role, grant it the needed privileges before running the rest of the script.

```sql
-- Run as a security or account administration role if needed.
GRANT USAGE ON WAREHOUSE TASK_DEMO_WH TO ROLE TASK_ADMIN;
GRANT USAGE ON DATABASE TASK_DEMO_DB TO ROLE TASK_ADMIN;
GRANT USAGE ON ALL SCHEMAS IN DATABASE TASK_DEMO_DB TO ROLE TASK_ADMIN;
GRANT CREATE TABLE ON SCHEMA TASK_DEMO_DB.RAW TO ROLE TASK_ADMIN;
GRANT CREATE TABLE ON SCHEMA TASK_DEMO_DB.MART TO ROLE TASK_ADMIN;
GRANT CREATE TABLE ON SCHEMA TASK_DEMO_DB.OPS TO ROLE TASK_ADMIN;
GRANT CREATE STREAM ON SCHEMA TASK_DEMO_DB.RAW TO ROLE TASK_ADMIN;
GRANT CREATE TASK ON SCHEMA TASK_DEMO_DB.MART TO ROLE TASK_ADMIN;
GRANT EXECUTE TASK ON ACCOUNT TO ROLE TASK_ADMIN;
```

## Step 2: Create sample source and target tables

This data is intentionally small so you can see what each task changes.

```sql
CREATE OR REPLACE TABLE RAW.ORDERS (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  CATEGORY STRING,
  ORDER_STATUS STRING,
  NET_SALES NUMBER(10, 2),
  UPDATED_AT TIMESTAMP_NTZ
);

INSERT INTO RAW.ORDERS (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  CATEGORY,
  ORDER_STATUS,
  NET_SALES,
  UPDATED_AT
)
SELECT * FROM VALUES
  (1001, 501, '2026-04-20'::DATE, 'Books',       'COMPLETE',  48.50, CURRENT_TIMESTAMP()),
  (1002, 502, '2026-04-20'::DATE, 'Electronics', 'COMPLETE', 299.99, CURRENT_TIMESTAMP()),
  (1003, 503, '2026-04-21'::DATE, 'Books',       'COMPLETE',  31.25, CURRENT_TIMESTAMP()),
  (1004, 501, '2026-04-21'::DATE, 'Home',        'RETURNED',  85.00, CURRENT_TIMESTAMP()),
  (1005, 504, '2026-04-22'::DATE, 'Electronics', 'COMPLETE', 140.00, CURRENT_TIMESTAMP()),
  (1006, 505, '2026-04-22'::DATE, 'Home',        'COMPLETE',  62.75, CURRENT_TIMESTAMP())
AS v (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  CATEGORY,
  ORDER_STATUS,
  NET_SALES,
  UPDATED_AT
);

CREATE OR REPLACE TABLE MART.DAILY_SALES_SUMMARY (
  ORDER_DATE DATE,
  NET_SALES NUMBER(10, 2),
  ORDER_COUNT NUMBER,
  UPDATED_AT TIMESTAMP_NTZ
);

CREATE OR REPLACE TABLE MART.ORDER_FACT (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  CATEGORY STRING,
  ORDER_STATUS STRING,
  NET_SALES NUMBER(10, 2),
  UPDATED_AT TIMESTAMP_NTZ
);

CREATE OR REPLACE TABLE MART.CATEGORY_SALES_SUMMARY (
  CATEGORY STRING,
  NET_SALES NUMBER(10, 2),
  ORDER_COUNT NUMBER,
  UPDATED_AT TIMESTAMP_NTZ
);

CREATE OR REPLACE TABLE OPS.TASK_AUDIT_LOG (
  EVENT_NAME STRING,
  EVENT_DETAIL STRING,
  CREATED_AT TIMESTAMP_NTZ
);

CREATE OR REPLACE TABLE OPS.DATA_QUALITY_RESULTS (
  CHECK_NAME STRING,
  CHECK_STATUS STRING,
  CHECK_DETAIL STRING,
  CREATED_AT TIMESTAMP_NTZ
);
```

Check the starting rows.

```sql
SELECT * FROM RAW.ORDERS ORDER BY ORDER_ID;
SELECT * FROM MART.DAILY_SALES_SUMMARY ORDER BY ORDER_DATE;
```

## Step 3: Create a scheduled task

New Snowflake tasks are created suspended. This task refreshes one summary table from the sample order data.

```sql
USE SCHEMA MART;

CREATE OR REPLACE TASK REFRESH_DAILY_SALES_SUMMARY
  WAREHOUSE = TASK_DEMO_WH
  SCHEDULE = '60 MINUTES'
  COMMENT = 'Demo task: refresh daily sales summary from RAW.ORDERS.'
AS
  MERGE INTO MART.DAILY_SALES_SUMMARY AS tgt
  USING (
    SELECT
      ORDER_DATE,
      SUM(IFF(ORDER_STATUS = 'COMPLETE', NET_SALES, 0)) AS NET_SALES,
      COUNT_IF(ORDER_STATUS = 'COMPLETE') AS ORDER_COUNT
    FROM RAW.ORDERS
    GROUP BY ORDER_DATE
  ) AS src
    ON tgt.ORDER_DATE = src.ORDER_DATE
  WHEN MATCHED THEN UPDATE SET
    tgt.NET_SALES = src.NET_SALES,
    tgt.ORDER_COUNT = src.ORDER_COUNT,
    tgt.UPDATED_AT = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT (
    ORDER_DATE,
    NET_SALES,
    ORDER_COUNT,
    UPDATED_AT
  )
  VALUES (
    src.ORDER_DATE,
    src.NET_SALES,
    src.ORDER_COUNT,
    CURRENT_TIMESTAMP()
  );
```

Inspect the task before running it.

```sql
DESCRIBE TASK MART.REFRESH_DAILY_SALES_SUMMARY;
SHOW TASKS LIKE 'REFRESH_DAILY_SALES_SUMMARY' IN SCHEMA MART;
```

Run it manually so you do not have to wait for the schedule.

```sql
EXECUTE TASK MART.REFRESH_DAILY_SALES_SUMMARY;
```

Give the task a few seconds, then check the target table.

```sql
SELECT *
FROM MART.DAILY_SALES_SUMMARY
ORDER BY ORDER_DATE;
```

Expected result:

| ORDER_DATE | NET_SALES | ORDER_COUNT |
|---|---:|---:|
| 2026-04-20 | 348.49 | 2 |
| 2026-04-21 | 31.25 | 1 |
| 2026-04-22 | 202.75 | 2 |

## Step 4: Resume, suspend, and change the schedule

A task only follows its schedule after it is resumed.

```sql
ALTER TASK MART.REFRESH_DAILY_SALES_SUMMARY RESUME;
```

For a demo, you may not want the task to keep running every hour. Suspend it after you confirm the syntax.

```sql
ALTER TASK MART.REFRESH_DAILY_SALES_SUMMARY SUSPEND;
```

Change the schedule when the business timing changes.

```sql
ALTER TASK MART.REFRESH_DAILY_SALES_SUMMARY
  SET SCHEDULE = 'USING CRON 0 5 * * * America/New_York';
```

Common schedule examples:

```sql
-- Every 10 minutes.
ALTER TASK MART.REFRESH_DAILY_SALES_SUMMARY
  SET SCHEDULE = '10 MINUTES';

-- Every weekday at 6:30 AM UTC.
ALTER TASK MART.REFRESH_DAILY_SALES_SUMMARY
  SET SCHEDULE = 'USING CRON 30 6 * * MON-FRI UTC';

-- Every day at 5:00 AM Eastern time.
ALTER TASK MART.REFRESH_DAILY_SALES_SUMMARY
  SET SCHEDULE = 'USING CRON 0 5 * * * America/New_York';
```

## Step 5: Create a stream-triggered task with new data

This pattern is useful when the task should only run after a stream has new rows.

Create the stream first.

```sql
USE SCHEMA RAW;

CREATE OR REPLACE STREAM ORDERS_STREAM
  ON TABLE RAW.ORDERS;
```

Insert new data after the stream is created so the stream has changes to consume.

```sql
INSERT INTO RAW.ORDERS (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  CATEGORY,
  ORDER_STATUS,
  NET_SALES,
  UPDATED_AT
)
SELECT * FROM VALUES
  (1007, 506, '2026-04-23'::DATE, 'Books',       'COMPLETE',  22.00, CURRENT_TIMESTAMP()),
  (1008, 507, '2026-04-23'::DATE, 'Home',        'COMPLETE', 110.40, CURRENT_TIMESTAMP()),
  (1009, 508, '2026-04-24'::DATE, 'Electronics', 'COMPLETE', 520.00, CURRENT_TIMESTAMP())
AS v (
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  CATEGORY,
  ORDER_STATUS,
  NET_SALES,
  UPDATED_AT
);
```

Check that the stream sees rows.

```sql
SELECT
  ORDER_ID,
  CUSTOMER_ID,
  ORDER_DATE,
  CATEGORY,
  ORDER_STATUS,
  NET_SALES,
  METADATA$ACTION,
  METADATA$ISUPDATE
FROM RAW.ORDERS_STREAM
ORDER BY ORDER_ID;
```

Create the task that consumes the stream and merges rows into `MART.ORDER_FACT`.

```sql
USE SCHEMA MART;

CREATE OR REPLACE TASK APPLY_ORDER_CHANGES
  WAREHOUSE = TASK_DEMO_WH
  SCHEDULE = '5 MINUTES'
  WHEN SYSTEM$STREAM_HAS_DATA('RAW.ORDERS_STREAM')
AS
  MERGE INTO MART.ORDER_FACT AS tgt
  USING (
    SELECT
      ORDER_ID,
      CUSTOMER_ID,
      ORDER_DATE,
      CATEGORY,
      ORDER_STATUS,
      NET_SALES,
      UPDATED_AT
    FROM RAW.ORDERS_STREAM
    WHERE METADATA$ACTION = 'INSERT'
  ) AS src
    ON tgt.ORDER_ID = src.ORDER_ID
  WHEN MATCHED THEN UPDATE SET
    tgt.CUSTOMER_ID = src.CUSTOMER_ID,
    tgt.ORDER_DATE = src.ORDER_DATE,
    tgt.CATEGORY = src.CATEGORY,
    tgt.ORDER_STATUS = src.ORDER_STATUS,
    tgt.NET_SALES = src.NET_SALES,
    tgt.UPDATED_AT = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT (
    ORDER_ID,
    CUSTOMER_ID,
    ORDER_DATE,
    CATEGORY,
    ORDER_STATUS,
    NET_SALES,
    UPDATED_AT
  )
  VALUES (
    src.ORDER_ID,
    src.CUSTOMER_ID,
    src.ORDER_DATE,
    src.CATEGORY,
    src.ORDER_STATUS,
    src.NET_SALES,
    CURRENT_TIMESTAMP()
  );
```

Run the task once and inspect the target table.

```sql
EXECUTE TASK MART.APPLY_ORDER_CHANGES;

SELECT *
FROM MART.ORDER_FACT
ORDER BY ORDER_ID;
```

If the merge consumed the stream, the stream should now be empty.

```sql
SELECT COUNT(*) AS REMAINING_STREAM_ROWS
FROM RAW.ORDERS_STREAM;
```

## Step 6: Create a task graph

A task graph starts with a root task. The root task has the schedule. Child tasks use `AFTER` and do not define their own schedules.

This graph does three things:

- root task writes a run record to an audit table
- first child refreshes category-level sales
- second child writes a data quality result

```sql
USE SCHEMA MART;

CREATE OR REPLACE TASK LOAD_ORDERS_ROOT
  WAREHOUSE = TASK_DEMO_WH
  SCHEDULE = '5 MINUTES'
  COMMENT = 'Demo root task for a small task graph.'
AS
  INSERT INTO OPS.TASK_AUDIT_LOG (
    EVENT_NAME,
    EVENT_DETAIL,
    CREATED_AT
  )
  VALUES (
    'LOAD_ORDERS_ROOT',
    'Root task fired for the demo task graph.',
    CURRENT_TIMESTAMP()
  );

CREATE OR REPLACE TASK BUILD_CATEGORY_SALES
  WAREHOUSE = TASK_DEMO_WH
  AFTER LOAD_ORDERS_ROOT
AS
  MERGE INTO MART.CATEGORY_SALES_SUMMARY AS tgt
  USING (
    SELECT
      CATEGORY,
      SUM(IFF(ORDER_STATUS = 'COMPLETE', NET_SALES, 0)) AS NET_SALES,
      COUNT_IF(ORDER_STATUS = 'COMPLETE') AS ORDER_COUNT
    FROM RAW.ORDERS
    GROUP BY CATEGORY
  ) AS src
    ON tgt.CATEGORY = src.CATEGORY
  WHEN MATCHED THEN UPDATE SET
    tgt.NET_SALES = src.NET_SALES,
    tgt.ORDER_COUNT = src.ORDER_COUNT,
    tgt.UPDATED_AT = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT (
    CATEGORY,
    NET_SALES,
    ORDER_COUNT,
    UPDATED_AT
  )
  VALUES (
    src.CATEGORY,
    src.NET_SALES,
    src.ORDER_COUNT,
    CURRENT_TIMESTAMP()
  );

CREATE OR REPLACE TASK CHECK_CATEGORY_SALES_QUALITY
  WAREHOUSE = TASK_DEMO_WH
  AFTER BUILD_CATEGORY_SALES
AS
  INSERT INTO OPS.DATA_QUALITY_RESULTS (
    CHECK_NAME,
    CHECK_STATUS,
    CHECK_DETAIL,
    CREATED_AT
  )
  SELECT
    'CATEGORY_SALES_HAS_ROWS' AS CHECK_NAME,
    IFF(COUNT(*) > 0, 'PASS', 'FAIL') AS CHECK_STATUS,
    'Rows in MART.CATEGORY_SALES_SUMMARY: ' || COUNT(*) AS CHECK_DETAIL,
    CURRENT_TIMESTAMP()
  FROM MART.CATEGORY_SALES_SUMMARY;
```

Resume child tasks first, then resume the root task.

```sql
ALTER TASK MART.CHECK_CATEGORY_SALES_QUALITY RESUME;
ALTER TASK MART.BUILD_CATEGORY_SALES RESUME;
ALTER TASK MART.LOAD_ORDERS_ROOT RESUME;
```

Let the graph run on its five-minute schedule, or manually execute the root task to start a run now.

```sql
EXECUTE TASK MART.LOAD_ORDERS_ROOT;
```

Give the graph a short window to finish, then check the outputs.

```sql
SELECT *
FROM OPS.TASK_AUDIT_LOG
ORDER BY CREATED_AT DESC;

SELECT *
FROM MART.CATEGORY_SALES_SUMMARY
ORDER BY CATEGORY;

SELECT *
FROM OPS.DATA_QUALITY_RESULTS
ORDER BY CREATED_AT DESC;
```

When you are done testing, suspend the root task first, then the children.

```sql
ALTER TASK MART.LOAD_ORDERS_ROOT SUSPEND;
ALTER TASK MART.BUILD_CATEGORY_SALES SUSPEND;
ALTER TASK MART.CHECK_CATEGORY_SALES_QUALITY SUSPEND;
```

## Step 7: Monitor task runs

Use `INFORMATION_SCHEMA.TASK_HISTORY` for recent task runs.

```sql
SELECT
  NAME,
  STATE,
  SCHEDULED_TIME,
  QUERY_START_TIME,
  COMPLETED_TIME,
  ERROR_CODE,
  ERROR_MESSAGE
FROM TABLE(
  INFORMATION_SCHEMA.TASK_HISTORY(
    SCHEDULED_TIME_RANGE_START => DATEADD(hour, -2, CURRENT_TIMESTAMP()),
    RESULT_LIMIT => 100
  )
)
WHERE DATABASE_NAME = 'TASK_DEMO_DB'
ORDER BY SCHEDULED_TIME DESC;
```

Filter to one task.

```sql
SELECT
  NAME,
  STATE,
  SCHEDULED_TIME,
  QUERY_START_TIME,
  COMPLETED_TIME,
  ERROR_CODE,
  ERROR_MESSAGE
FROM TABLE(
  INFORMATION_SCHEMA.TASK_HISTORY(
    SCHEDULED_TIME_RANGE_START => DATEADD(hour, -2, CURRENT_TIMESTAMP()),
    RESULT_LIMIT => 100,
    TASK_NAME => 'REFRESH_DAILY_SALES_SUMMARY'
  )
)
ORDER BY SCHEDULED_TIME DESC;
```

Filter to failures.

```sql
SELECT
  NAME,
  STATE,
  SCHEDULED_TIME,
  ERROR_CODE,
  ERROR_MESSAGE
FROM TABLE(
  INFORMATION_SCHEMA.TASK_HISTORY(
    SCHEDULED_TIME_RANGE_START => DATEADD(day, -7, CURRENT_TIMESTAMP()),
    RESULT_LIMIT => 1000,
    ERROR_ONLY => TRUE
  )
)
WHERE DATABASE_NAME = 'TASK_DEMO_DB'
ORDER BY SCHEDULED_TIME DESC;
```

For longer retention and account-wide reporting, query `SNOWFLAKE.ACCOUNT_USAGE.TASK_HISTORY`.

```sql
SELECT
  DATABASE_NAME,
  SCHEMA_NAME,
  NAME,
  STATE,
  SCHEDULED_TIME,
  COMPLETED_TIME,
  ERROR_CODE,
  ERROR_MESSAGE
FROM SNOWFLAKE.ACCOUNT_USAGE.TASK_HISTORY
WHERE DATABASE_NAME = 'TASK_DEMO_DB'
  AND SCHEDULED_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
ORDER BY SCHEDULED_TIME DESC;
```

Account Usage views can lag, so use `INFORMATION_SCHEMA.TASK_HISTORY` when you need a quick check right after a run.

## Step 8: Inspect definitions and dependencies

Use these commands when you need to understand what exists before changing it.

```sql
SHOW TASKS IN SCHEMA MART;

DESCRIBE TASK MART.REFRESH_DAILY_SALES_SUMMARY;

SELECT *
FROM TABLE(
  INFORMATION_SCHEMA.TASK_DEPENDENTS(
    TASK_NAME => 'TASK_DEMO_DB.MART.LOAD_ORDERS_ROOT',
    RECURSIVE => TRUE
  )
);
```

You can also inspect task definitions from `SHOW TASKS` output.

```sql
SHOW TASKS IN DATABASE TASK_DEMO_DB;
```

## Step 9: Clean up

Suspend tasks before dropping them. This avoids scheduled runs firing while you are cleaning up.

```sql
ALTER TASK IF EXISTS MART.REFRESH_DAILY_SALES_SUMMARY SUSPEND;
ALTER TASK IF EXISTS MART.APPLY_ORDER_CHANGES SUSPEND;
ALTER TASK IF EXISTS MART.LOAD_ORDERS_ROOT SUSPEND;
ALTER TASK IF EXISTS MART.BUILD_CATEGORY_SALES SUSPEND;
ALTER TASK IF EXISTS MART.CHECK_CATEGORY_SALES_QUALITY SUSPEND;

DROP TASK IF EXISTS MART.CHECK_CATEGORY_SALES_QUALITY;
DROP TASK IF EXISTS MART.BUILD_CATEGORY_SALES;
DROP TASK IF EXISTS MART.LOAD_ORDERS_ROOT;
DROP TASK IF EXISTS MART.APPLY_ORDER_CHANGES;
DROP TASK IF EXISTS MART.REFRESH_DAILY_SALES_SUMMARY;

DROP DATABASE IF EXISTS TASK_DEMO_DB;
DROP WAREHOUSE IF EXISTS TASK_DEMO_WH;
```

## Production habits

The demo is intentionally small, but the same operating habits apply in production:

- use a dedicated owner role for task objects
- keep task SQL in source control
- use explicit time zones for cron schedules
- resume child tasks before root tasks
- suspend root tasks before changing a graph
- monitor failures through `TASK_HISTORY`
- write task outputs or procedure logs that make failures easy to debug

Tasks are simple to create, but they become durable when they are operated like production jobs: named clearly, owned by a stable role, deployed from repeatable SQL, and monitored with history queries.
