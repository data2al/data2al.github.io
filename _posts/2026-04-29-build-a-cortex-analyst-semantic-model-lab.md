---
layout: post
title: "Build a Cortex Analyst Semantic Model Lab"
categories: [AI/Data Science Lab]
tags: Snowflake Cortex-Analyst Semantic-Model GenAI Analytics Governance
author: Alan
summary: "A Cortex Analyst lab for creating governed sales data, drafting a semantic model, asking natural-language questions, validating SQL, and cleaning up."
level: Intermediate
permalink: /ai-data-science-lab/build-a-cortex-analyst-semantic-model-lab/
---

* content
{:toc}

Cortex Analyst helps business users ask governed analytical questions in natural language. The important design work is the semantic model: measures, dimensions, synonyms, verified query patterns, and clear limits.

This lab creates a small sales mart and a semantic model draft you can upload to a stage for Cortex Analyst testing.

## Step 1: Create sample analytics data

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.CORTEX_ANALYST_LAB;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA CORTEX_ANALYST_LAB;

CREATE OR REPLACE TABLE SALES_DAILY (
  ORDER_DATE DATE,
  REGION STRING,
  PRODUCT_CATEGORY STRING,
  NET_REVENUE NUMBER(12, 2),
  ORDER_COUNT NUMBER
);

INSERT INTO SALES_DAILY
SELECT * FROM VALUES
  ('2026-04-01'::DATE, 'West', 'Books', 1200.00, 42),
  ('2026-04-01'::DATE, 'West', 'Electronics', 3400.00, 18),
  ('2026-04-01'::DATE, 'East', 'Books', 980.00, 37),
  ('2026-04-02'::DATE, 'West', 'Books', 1265.00, 44),
  ('2026-04-02'::DATE, 'East', 'Electronics', 4100.00, 21),
  ('2026-04-02'::DATE, 'Central', 'Home', 860.00, 16)
AS v (ORDER_DATE, REGION, PRODUCT_CATEGORY, NET_REVENUE, ORDER_COUNT);

CREATE STAGE IF NOT EXISTS SEMANTIC_MODELS;
```

## Step 2: Draft the semantic model

Save this as `sales_semantic_model.yaml`.

```yaml
name: sales_daily_semantic_model
description: Governed sales analytics model for daily revenue and order questions.
tables:
  - name: sales_daily
    base_table:
      database: AI_DS_LAB_DB
      schema: CORTEX_ANALYST_LAB
      table: SALES_DAILY
    dimensions:
      - name: region
        expr: REGION
        data_type: TEXT
        synonyms: [market, territory]
      - name: product_category
        expr: PRODUCT_CATEGORY
        data_type: TEXT
        synonyms: [category, product group]
      - name: order_date
        expr: ORDER_DATE
        data_type: DATE
        synonyms: [date, sales date]
    measures:
      - name: net_revenue
        expr: NET_REVENUE
        data_type: NUMBER
        default_aggregation: sum
        synonyms: [sales, revenue, net sales]
      - name: order_count
        expr: ORDER_COUNT
        data_type: NUMBER
        default_aggregation: sum
        synonyms: [orders, transactions]
    verified_queries:
      - name: revenue_by_region
        question: What is total revenue by region?
        sql: |
          SELECT REGION, SUM(NET_REVENUE) AS NET_REVENUE
          FROM AI_DS_LAB_DB.CORTEX_ANALYST_LAB.SALES_DAILY
          GROUP BY REGION
          ORDER BY NET_REVENUE DESC
```

Upload the model to the stage.

```sql
PUT file://sales_semantic_model.yaml @SEMANTIC_MODELS AUTO_COMPRESS = FALSE OVERWRITE = TRUE;
LIST @SEMANTIC_MODELS;
```

## Step 3: Validate expected SQL manually

Before exposing natural-language analytics, confirm the semantic model points to the right business logic.

```sql
SELECT
  REGION,
  SUM(NET_REVENUE) AS NET_REVENUE,
  SUM(ORDER_COUNT) AS ORDER_COUNT
FROM SALES_DAILY
GROUP BY REGION
ORDER BY NET_REVENUE DESC;

SELECT
  PRODUCT_CATEGORY,
  SUM(NET_REVENUE) / NULLIF(SUM(ORDER_COUNT), 0) AS AVG_ORDER_VALUE
FROM SALES_DAILY
GROUP BY PRODUCT_CATEGORY
ORDER BY AVG_ORDER_VALUE DESC;
```

## Step 4: Ask Cortex Analyst questions

Use the staged semantic model from Snowsight or the Cortex Analyst REST API. Start with questions that match verified business language:

- What is total revenue by region?
- Which product category has the highest average order value?
- Show revenue and order count by date.

For every generated query, check:

- the selected table is `SALES_DAILY`
- revenue uses `SUM(NET_REVENUE)`
- order count uses `SUM(ORDER_COUNT)`
- the generated SQL does not invent columns

## Step 5: Store validation results

```sql
CREATE OR REPLACE TABLE ANALYST_VALIDATION_RESULTS (
  QUESTION STRING,
  EXPECTED_MEASURE STRING,
  GENERATED_SQL_PASSED BOOLEAN,
  REVIEW_NOTES STRING,
  REVIEWED_AT TIMESTAMP_NTZ
);

INSERT INTO ANALYST_VALIDATION_RESULTS
SELECT
  'What is total revenue by region?',
  'SUM(NET_REVENUE)',
  TRUE,
  'Verified against manual SQL query.',
  CURRENT_TIMESTAMP();

SELECT * FROM ANALYST_VALIDATION_RESULTS;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS ANALYST_VALIDATION_RESULTS;
DROP STAGE IF EXISTS SEMANTIC_MODELS;
DROP TABLE IF EXISTS SALES_DAILY;
```
