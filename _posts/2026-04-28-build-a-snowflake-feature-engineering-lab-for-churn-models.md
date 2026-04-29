---
layout: post
title: "Build a Snowflake Feature Engineering Lab for Churn Models"
categories: [AI/Data Science Lab]
tags: Snowflake Data-Science Feature-Engineering Snowpark ML Churn
author: Alan
summary: "A runnable lab for preparing customer churn features in Snowflake with sample events, data quality checks, train/test splits, and cleanup."
level: Intermediate
permalink: /ai-data-science-lab/build-a-snowflake-feature-engineering-lab-for-churn-models/
---

* content
{:toc}

This lab shows how to turn raw customer activity into a model-ready feature table inside Snowflake. It covers the practical data science work that comes before model training: framing a label, cleaning data, creating features, checking leakage, and splitting data for repeatable experiments.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.RAW;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.FEATURES;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.ML;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA RAW;
```

## Step 2: Create sample customer data

```sql
CREATE OR REPLACE TABLE RAW.CUSTOMER_EVENTS (
  CUSTOMER_ID NUMBER,
  EVENT_DATE DATE,
  EVENT_TYPE STRING,
  CHANNEL STRING,
  EVENT_VALUE NUMBER(10, 2)
);

INSERT INTO RAW.CUSTOMER_EVENTS
SELECT * FROM VALUES
  (101, '2026-01-01'::DATE, 'login',   'web',     1),
  (101, '2026-01-04'::DATE, 'ticket',  'email',   1),
  (101, '2026-01-20'::DATE, 'invoice', 'billing', 75),
  (102, '2026-01-02'::DATE, 'login',   'mobile',  1),
  (102, '2026-01-12'::DATE, 'usage',   'api',     42),
  (102, '2026-01-25'::DATE, 'invoice', 'billing', 120),
  (103, '2026-01-02'::DATE, 'login',   'web',     1),
  (103, '2026-01-10'::DATE, 'ticket',  'chat',    1),
  (103, '2026-01-29'::DATE, 'ticket',  'email',   1),
  (104, '2026-01-03'::DATE, 'login',   'web',     1),
  (104, '2026-01-15'::DATE, 'usage',   'api',     8),
  (105, '2026-01-07'::DATE, 'login',   'mobile',  1),
  (105, '2026-01-22'::DATE, 'usage',   'api',     95),
  (106, '2026-01-08'::DATE, 'ticket',  'chat',    1),
  (106, '2026-01-30'::DATE, 'invoice', 'billing', 40)
AS v (CUSTOMER_ID, EVENT_DATE, EVENT_TYPE, CHANNEL, EVENT_VALUE);

CREATE OR REPLACE TABLE RAW.CUSTOMER_OUTCOMES (
  CUSTOMER_ID NUMBER,
  OBSERVATION_DATE DATE,
  CHURNED NUMBER
);

INSERT INTO RAW.CUSTOMER_OUTCOMES
SELECT * FROM VALUES
  (101, '2026-02-01'::DATE, 1),
  (102, '2026-02-01'::DATE, 0),
  (103, '2026-02-01'::DATE, 1),
  (104, '2026-02-01'::DATE, 0),
  (105, '2026-02-01'::DATE, 0),
  (106, '2026-02-01'::DATE, 1)
AS v (CUSTOMER_ID, OBSERVATION_DATE, CHURNED);
```

## Step 3: Build model-ready features

Keep the label date separate from the event window so the feature table does not leak future knowledge into training.

```sql
CREATE OR REPLACE TABLE FEATURES.CUSTOMER_CHURN_FEATURES AS
WITH observation AS (
  SELECT CUSTOMER_ID, OBSERVATION_DATE, CHURNED
  FROM RAW.CUSTOMER_OUTCOMES
),
activity AS (
  SELECT
    o.CUSTOMER_ID,
    COUNT(*) AS EVENT_COUNT_30D,
    COUNT_IF(e.EVENT_TYPE = 'ticket') AS SUPPORT_TICKETS_30D,
    COUNT_IF(e.EVENT_TYPE = 'usage') AS USAGE_EVENTS_30D,
    SUM(IFF(e.EVENT_TYPE = 'invoice', e.EVENT_VALUE, 0)) AS BILLING_AMOUNT_30D,
    DATEDIFF('day', MAX(e.EVENT_DATE), o.OBSERVATION_DATE) AS DAYS_SINCE_LAST_EVENT,
    COUNT(DISTINCT e.CHANNEL) AS CHANNEL_COUNT_30D
  FROM observation o
  LEFT JOIN RAW.CUSTOMER_EVENTS e
    ON e.CUSTOMER_ID = o.CUSTOMER_ID
   AND e.EVENT_DATE < o.OBSERVATION_DATE
   AND e.EVENT_DATE >= DATEADD('day', -30, o.OBSERVATION_DATE)
  GROUP BY o.CUSTOMER_ID, o.OBSERVATION_DATE
)
SELECT
  o.CUSTOMER_ID,
  o.OBSERVATION_DATE,
  COALESCE(a.EVENT_COUNT_30D, 0) AS EVENT_COUNT_30D,
  COALESCE(a.SUPPORT_TICKETS_30D, 0) AS SUPPORT_TICKETS_30D,
  COALESCE(a.USAGE_EVENTS_30D, 0) AS USAGE_EVENTS_30D,
  COALESCE(a.BILLING_AMOUNT_30D, 0) AS BILLING_AMOUNT_30D,
  COALESCE(a.DAYS_SINCE_LAST_EVENT, 999) AS DAYS_SINCE_LAST_EVENT,
  COALESCE(a.CHANNEL_COUNT_30D, 0) AS CHANNEL_COUNT_30D,
  o.CHURNED AS LABEL_CHURNED
FROM observation o
LEFT JOIN activity a
  ON o.CUSTOMER_ID = a.CUSTOMER_ID;
```

## Step 4: Add reproducible train and test splits

```sql
CREATE OR REPLACE TABLE ML.CUSTOMER_CHURN_TRAIN AS
SELECT *
FROM FEATURES.CUSTOMER_CHURN_FEATURES
WHERE MOD(ABS(HASH(CUSTOMER_ID)), 10) < 7;

CREATE OR REPLACE TABLE ML.CUSTOMER_CHURN_TEST AS
SELECT *
FROM FEATURES.CUSTOMER_CHURN_FEATURES
WHERE MOD(ABS(HASH(CUSTOMER_ID)), 10) >= 7;
```

## Step 5: Run evaluation checks

These checks validate the shape of the training data before a model sees it.

```sql
-- Class balance.
SELECT LABEL_CHURNED, COUNT(*) AS ROW_COUNT
FROM FEATURES.CUSTOMER_CHURN_FEATURES
GROUP BY LABEL_CHURNED
ORDER BY LABEL_CHURNED;

-- Null checks.
SELECT
  COUNT_IF(EVENT_COUNT_30D IS NULL) AS NULL_EVENT_COUNT,
  COUNT_IF(SUPPORT_TICKETS_30D IS NULL) AS NULL_TICKET_COUNT,
  COUNT_IF(LABEL_CHURNED IS NULL) AS NULL_LABEL_COUNT
FROM FEATURES.CUSTOMER_CHURN_FEATURES;

-- Leakage check: no event should occur on or after the observation date.
SELECT COUNT(*) AS LEAKED_EVENT_ROWS
FROM RAW.CUSTOMER_EVENTS e
JOIN RAW.CUSTOMER_OUTCOMES o
  ON e.CUSTOMER_ID = o.CUSTOMER_ID
WHERE e.EVENT_DATE >= o.OBSERVATION_DATE;

-- Feature distribution check.
SELECT
  MIN(EVENT_COUNT_30D) AS MIN_EVENTS,
  MAX(EVENT_COUNT_30D) AS MAX_EVENTS,
  AVG(SUPPORT_TICKETS_30D) AS AVG_TICKETS,
  AVG(DAYS_SINCE_LAST_EVENT) AS AVG_RECENCY
FROM FEATURES.CUSTOMER_CHURN_FEATURES;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS ML.CUSTOMER_CHURN_TEST;
DROP TABLE IF EXISTS ML.CUSTOMER_CHURN_TRAIN;
DROP TABLE IF EXISTS FEATURES.CUSTOMER_CHURN_FEATURES;
DROP TABLE IF EXISTS RAW.CUSTOMER_OUTCOMES;
DROP TABLE IF EXISTS RAW.CUSTOMER_EVENTS;
```
