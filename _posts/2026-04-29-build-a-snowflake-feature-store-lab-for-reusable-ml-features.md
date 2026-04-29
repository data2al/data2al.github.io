---
layout: post
title: "Build a Snowflake Feature Store Lab for Reusable ML Features"
categories: [AI/Data Science Lab]
tags: Snowflake Feature-Store Data-Science Feature-Engineering Snowpark-ML
author: Alan
summary: "A Snowflake Feature Store lab for defining reusable customer features, creating training data, validating freshness, and cleaning up."
level: Intermediate
permalink: /ai-data-science-lab/build-a-snowflake-feature-store-lab-for-reusable-ml-features/
---

* content
{:toc}

Feature engineering is easier to govern when features are reusable, documented, and refreshed consistently. This lab shows the shape of a Snowflake Feature Store workflow: create source data, define entities and feature views, generate training data, check feature quality, and clean up.

Use a Snowflake Notebook with a Python runtime that includes Snowpark and Snowflake ML packages.

## Step 1: Create source data

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.FEATURE_STORE_LAB;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA FEATURE_STORE_LAB;

CREATE OR REPLACE TABLE CUSTOMER_ACTIVITY (
  CUSTOMER_ID NUMBER,
  EVENT_DATE DATE,
  LOGINS NUMBER,
  SUPPORT_TICKETS NUMBER,
  SPEND NUMBER(10, 2)
);

INSERT INTO CUSTOMER_ACTIVITY
SELECT * FROM VALUES
  (101, '2026-01-01'::DATE, 3, 0, 75.00),
  (101, '2026-01-02'::DATE, 1, 1, 0.00),
  (102, '2026-01-01'::DATE, 5, 0, 120.00),
  (102, '2026-01-02'::DATE, 4, 0, 25.00),
  (103, '2026-01-01'::DATE, 1, 2, 0.00),
  (103, '2026-01-02'::DATE, 0, 1, 0.00)
AS v (CUSTOMER_ID, EVENT_DATE, LOGINS, SUPPORT_TICKETS, SPEND);

CREATE OR REPLACE TABLE CUSTOMER_LABELS (
  CUSTOMER_ID NUMBER,
  LABEL_DATE DATE,
  CHURNED NUMBER
);

INSERT INTO CUSTOMER_LABELS
SELECT * FROM VALUES
  (101, '2026-02-01'::DATE, 0),
  (102, '2026-02-01'::DATE, 0),
  (103, '2026-02-01'::DATE, 1)
AS v (CUSTOMER_ID, LABEL_DATE, CHURNED);
```

## Step 2: Define reusable features

If Feature Store is enabled in your account, run this in a Python cell.

```python
from snowflake.snowpark.context import get_active_session
from snowflake.ml.feature_store import FeatureStore, Entity, FeatureView, CreationMode

session = get_active_session()

fs = FeatureStore(
    session=session,
    database="AI_DS_LAB_DB",
    name="FEATURE_STORE_LAB",
    default_warehouse="AI_DS_LAB_WH",
    creation_mode=CreationMode.CREATE_IF_NOT_EXIST,
)

customer = Entity(
    name="CUSTOMER",
    join_keys=["CUSTOMER_ID"],
    desc="Customer entity for churn and engagement features.",
)
fs.register_entity(customer)

activity_df = session.sql("""
    SELECT
      CUSTOMER_ID,
      MAX(EVENT_DATE) AS FEATURE_TS,
      SUM(LOGINS) AS LOGINS_30D,
      SUM(SUPPORT_TICKETS) AS SUPPORT_TICKETS_30D,
      SUM(SPEND) AS SPEND_30D,
      DATEDIFF('day', MAX(EVENT_DATE), '2026-02-01'::DATE) AS DAYS_SINCE_ACTIVITY
    FROM AI_DS_LAB_DB.FEATURE_STORE_LAB.CUSTOMER_ACTIVITY
    GROUP BY CUSTOMER_ID
""")

feature_view = FeatureView(
    name="CUSTOMER_ENGAGEMENT_30D",
    entities=[customer],
    feature_df=activity_df,
    timestamp_col="FEATURE_TS",
    refresh_freq="1 day",
    desc="Thirty-day customer engagement and support features.",
)

registered_view = fs.register_feature_view(
    feature_view=feature_view,
    version="V1",
    block=True,
)
```

## Step 3: Create training data

```python
labels = session.table("AI_DS_LAB_DB.FEATURE_STORE_LAB.CUSTOMER_LABELS")

training_data = fs.generate_dataset(
    name="CUSTOMER_CHURN_TRAINING_SET",
    spine_df=labels,
    features=[registered_view],
    spine_timestamp_col="LABEL_DATE",
    spine_label_cols=["CHURNED"],
)

training_data.read.to_snowpark_dataframe().write.mode("overwrite").save_as_table(
    "AI_DS_LAB_DB.FEATURE_STORE_LAB.CUSTOMER_CHURN_TRAINING_SET"
)
```

## Step 4: Validate feature freshness and nulls

```sql
SELECT
  COUNT(*) AS ROW_COUNT,
  COUNT_IF(LOGINS_30D IS NULL) AS NULL_LOGINS,
  COUNT_IF(SUPPORT_TICKETS_30D IS NULL) AS NULL_TICKETS,
  COUNT_IF(SPEND_30D IS NULL) AS NULL_SPEND,
  MAX(DAYS_SINCE_ACTIVITY) AS MAX_DAYS_SINCE_ACTIVITY
FROM CUSTOMER_CHURN_TRAINING_SET;

SELECT
  CUSTOMER_ID,
  CHURNED,
  LOGINS_30D,
  SUPPORT_TICKETS_30D,
  SPEND_30D,
  DAYS_SINCE_ACTIVITY
FROM CUSTOMER_CHURN_TRAINING_SET
ORDER BY CUSTOMER_ID;
```

## Step 5: Use the feature table in a model workflow

```sql
CREATE OR REPLACE TABLE CUSTOMER_CHURN_TRAIN_READY AS
SELECT
  CUSTOMER_ID,
  COALESCE(LOGINS_30D, 0) AS LOGINS_30D,
  COALESCE(SUPPORT_TICKETS_30D, 0) AS SUPPORT_TICKETS_30D,
  COALESCE(SPEND_30D, 0) AS SPEND_30D,
  COALESCE(DAYS_SINCE_ACTIVITY, 999) AS DAYS_SINCE_ACTIVITY,
  CHURNED AS LABEL_CHURNED
FROM CUSTOMER_CHURN_TRAINING_SET;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS CUSTOMER_CHURN_TRAIN_READY;
DROP TABLE IF EXISTS CUSTOMER_CHURN_TRAINING_SET;
DROP TABLE IF EXISTS CUSTOMER_LABELS;
DROP TABLE IF EXISTS CUSTOMER_ACTIVITY;
```

In a shared Feature Store environment, remove registered entities and feature views only if they were created solely for this demo.
