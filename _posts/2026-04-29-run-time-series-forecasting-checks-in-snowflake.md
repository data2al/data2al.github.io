---
layout: post
title: "Run Time Series Forecasting Checks in Snowflake"
categories: [AI/Data Science Lab]
tags: Snowflake Data-Science Forecasting Evaluation Cortex
author: Alan
summary: "A forecasting lab that prepares sample demand data, builds a simple baseline, evaluates forecast error, explains results, and cleans up."
level: Intermediate
permalink: /ai-data-science-lab/run-time-series-forecasting-checks-in-snowflake/
---

* content
{:toc}

Forecasting is a common data science workload, and exam-style scenarios often test whether you can separate model output from evaluation. This lab creates sample demand data, builds a transparent moving-average forecast, checks error metrics, and uses Cortex to summarize the business result.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.FORECASTING;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA FORECASTING;
```

## Step 2: Create sample demand data

```sql
CREATE OR REPLACE TABLE DAILY_DEMAND (
  DEMAND_DATE DATE,
  SKU STRING,
  UNITS_SOLD NUMBER
);

INSERT INTO DAILY_DEMAND
SELECT * FROM VALUES
  ('2026-01-01'::DATE, 'SKU-1', 44),
  ('2026-01-02'::DATE, 'SKU-1', 47),
  ('2026-01-03'::DATE, 'SKU-1', 49),
  ('2026-01-04'::DATE, 'SKU-1', 52),
  ('2026-01-05'::DATE, 'SKU-1', 51),
  ('2026-01-06'::DATE, 'SKU-1', 56),
  ('2026-01-07'::DATE, 'SKU-1', 59),
  ('2026-01-08'::DATE, 'SKU-1', 60),
  ('2026-01-09'::DATE, 'SKU-1', 63),
  ('2026-01-10'::DATE, 'SKU-1', 67),
  ('2026-01-11'::DATE, 'SKU-1', 65),
  ('2026-01-12'::DATE, 'SKU-1', 70)
AS v (DEMAND_DATE, SKU, UNITS_SOLD);
```

## Step 3: Build a baseline forecast

```sql
CREATE OR REPLACE TABLE DEMAND_FORECAST AS
SELECT
  DEMAND_DATE,
  SKU,
  UNITS_SOLD,
  AVG(UNITS_SOLD) OVER (
    PARTITION BY SKU
    ORDER BY DEMAND_DATE
    ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
  ) AS FORECAST_UNITS
FROM DAILY_DEMAND;
```

## Step 4: Evaluate forecast quality

```sql
CREATE OR REPLACE TABLE FORECAST_EVAL AS
SELECT
  SKU,
  COUNT_IF(FORECAST_UNITS IS NOT NULL) AS EVALUATED_DAYS,
  AVG(ABS(UNITS_SOLD - FORECAST_UNITS)) AS MAE,
  SQRT(AVG(POWER(UNITS_SOLD - FORECAST_UNITS, 2))) AS RMSE,
  AVG(ABS(UNITS_SOLD - FORECAST_UNITS) / NULLIF(UNITS_SOLD, 0)) AS MAPE
FROM DEMAND_FORECAST
WHERE FORECAST_UNITS IS NOT NULL
GROUP BY SKU;

SELECT * FROM FORECAST_EVAL;
```

## Step 5: Explain the result with Cortex

```sql
CREATE OR REPLACE TABLE FORECAST_SUMMARY AS
SELECT
  SKU,
  SNOWFLAKE.CORTEX.COMPLETE(
    'mistral-large2',
    'Write a concise business interpretation of this forecast evaluation. ' ||
    'Mention MAE, RMSE, and whether the baseline needs more features. ' ||
    'SKU=' || SKU || ', MAE=' || ROUND(MAE, 2) || ', RMSE=' || ROUND(RMSE, 2) || ', MAPE=' || ROUND(MAPE, 4)
  ) AS SUMMARY
FROM FORECAST_EVAL;

SELECT * FROM FORECAST_SUMMARY;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS FORECAST_SUMMARY;
DROP TABLE IF EXISTS FORECAST_EVAL;
DROP TABLE IF EXISTS DEMAND_FORECAST;
DROP TABLE IF EXISTS DAILY_DEMAND;
```
