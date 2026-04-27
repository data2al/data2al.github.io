---
layout: post
title: "Control Pipelines With Snowflake Scripting Procedures"
categories: [Data Engineering Lab]
tags: Snowflake Scripting Stored-Procedures MERGE Error-Handling
author: Alan
summary: "A runnable lab for creating a Snowflake Scripting stored procedure that validates staged data, merges clean rows, logs results, and handles errors."
level: Intermediate
permalink: /data-engineering-lab/control-pipelines-with-snowflake-scripting-procedures/
---

* content
{:toc}

Stored procedures and Snowflake Scripting are useful when a pipeline needs branching, validation, logging, or error handling beyond one SQL statement. This lab creates a small load procedure you can run from start to finish.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS SCRIPTING_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS SCRIPTING_LAB_DB;
CREATE SCHEMA IF NOT EXISTS SCRIPTING_LAB_DB.RAW;
CREATE SCHEMA IF NOT EXISTS SCRIPTING_LAB_DB.MART;
CREATE SCHEMA IF NOT EXISTS SCRIPTING_LAB_DB.OPS;

USE WAREHOUSE SCRIPTING_LAB_WH;
USE DATABASE SCRIPTING_LAB_DB;
```

## Step 2: Create source, target, and log tables

```sql
CREATE OR REPLACE TABLE RAW.STAGED_ORDERS (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  ORDER_STATUS STRING,
  NET_SALES NUMBER(10, 2)
);

CREATE OR REPLACE TABLE MART.ORDER_FACT (
  ORDER_ID NUMBER,
  CUSTOMER_ID NUMBER,
  ORDER_DATE DATE,
  ORDER_STATUS STRING,
  NET_SALES NUMBER(10, 2),
  UPDATED_AT TIMESTAMP_NTZ
);

CREATE OR REPLACE TABLE OPS.PIPELINE_RUN_LOG (
  RUN_ID STRING,
  PROCEDURE_NAME STRING,
  STATUS STRING,
  ROWS_IN_STAGE NUMBER,
  DETAIL STRING,
  CREATED_AT TIMESTAMP_NTZ
);
```

## Step 3: Insert sample staged data

```sql
INSERT INTO RAW.STAGED_ORDERS
SELECT * FROM VALUES
  (1, 101, '2026-04-01'::DATE, 'COMPLETE', 120.00),
  (2, 102, '2026-04-01'::DATE, 'COMPLETE',  80.50),
  (3, 103, '2026-04-02'::DATE, 'RETURNED',  42.00)
AS v (ORDER_ID, CUSTOMER_ID, ORDER_DATE, ORDER_STATUS, NET_SALES);
```

## Step 4: Create the procedure

```sql
CREATE OR REPLACE PROCEDURE MART.SP_LOAD_ORDER_FACT()
RETURNS STRING
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
  v_run_id STRING DEFAULT UUID_STRING();
  v_stage_count NUMBER DEFAULT 0;
  v_bad_count NUMBER DEFAULT 0;
BEGIN
  SELECT COUNT(*) INTO :v_stage_count
  FROM RAW.STAGED_ORDERS;

  SELECT COUNT(*) INTO :v_bad_count
  FROM RAW.STAGED_ORDERS
  WHERE ORDER_ID IS NULL
     OR CUSTOMER_ID IS NULL
     OR ORDER_DATE IS NULL
     OR NET_SALES < 0;

  IF (v_stage_count = 0) THEN
    INSERT INTO OPS.PIPELINE_RUN_LOG
    VALUES (:v_run_id, 'SP_LOAD_ORDER_FACT', 'SKIPPED', :v_stage_count, 'No staged rows found.', CURRENT_TIMESTAMP());

    RETURN 'SKIPPED: no staged rows found';
  END IF;

  IF (v_bad_count > 0) THEN
    INSERT INTO OPS.PIPELINE_RUN_LOG
    VALUES (:v_run_id, 'SP_LOAD_ORDER_FACT', 'FAILED_VALIDATION', :v_stage_count, 'Invalid staged rows: ' || :v_bad_count, CURRENT_TIMESTAMP());

    RETURN 'FAILED_VALIDATION: invalid staged rows found';
  END IF;

  MERGE INTO MART.ORDER_FACT AS tgt
  USING RAW.STAGED_ORDERS AS src
    ON tgt.ORDER_ID = src.ORDER_ID
  WHEN MATCHED THEN UPDATE SET
    tgt.CUSTOMER_ID = src.CUSTOMER_ID,
    tgt.ORDER_DATE = src.ORDER_DATE,
    tgt.ORDER_STATUS = src.ORDER_STATUS,
    tgt.NET_SALES = src.NET_SALES,
    tgt.UPDATED_AT = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT (
    ORDER_ID,
    CUSTOMER_ID,
    ORDER_DATE,
    ORDER_STATUS,
    NET_SALES,
    UPDATED_AT
  )
  VALUES (
    src.ORDER_ID,
    src.CUSTOMER_ID,
    src.ORDER_DATE,
    src.ORDER_STATUS,
    src.NET_SALES,
    CURRENT_TIMESTAMP()
  );

  INSERT INTO OPS.PIPELINE_RUN_LOG
  VALUES (:v_run_id, 'SP_LOAD_ORDER_FACT', 'SUCCESS', :v_stage_count, 'Order fact merge completed.', CURRENT_TIMESTAMP());

  RETURN 'SUCCESS: merged staged rows into MART.ORDER_FACT';

EXCEPTION
  WHEN OTHER THEN
    INSERT INTO OPS.PIPELINE_RUN_LOG
    VALUES (:v_run_id, 'SP_LOAD_ORDER_FACT', 'ERROR', :v_stage_count, SQLERRM, CURRENT_TIMESTAMP());

    RETURN 'ERROR: ' || SQLERRM;
END;
$$;
```

## Step 5: Run the procedure and inspect results

```sql
CALL MART.SP_LOAD_ORDER_FACT();

SELECT *
FROM MART.ORDER_FACT
ORDER BY ORDER_ID;

SELECT *
FROM OPS.PIPELINE_RUN_LOG
ORDER BY CREATED_AT DESC;
```

## Step 6: Test validation behavior

```sql
INSERT INTO RAW.STAGED_ORDERS
VALUES (4, 104, '2026-04-03'::DATE, 'COMPLETE', -10.00);

CALL MART.SP_LOAD_ORDER_FACT();

SELECT *
FROM OPS.PIPELINE_RUN_LOG
ORDER BY CREATED_AT DESC;
```

Remove the bad row and run again.

```sql
DELETE FROM RAW.STAGED_ORDERS
WHERE NET_SALES < 0;

CALL MART.SP_LOAD_ORDER_FACT();
```

## Step 7: Clean up

```sql
DROP DATABASE IF EXISTS SCRIPTING_LAB_DB;
DROP WAREHOUSE IF EXISTS SCRIPTING_LAB_WH;
```

## Certification focus

Use procedures when orchestration needs validation, branching, logging, transactions, or error handling. Use plain SQL or tasks when the workflow is simple enough to remain declarative.
