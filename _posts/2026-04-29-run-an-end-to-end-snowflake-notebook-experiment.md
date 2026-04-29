---
layout: post
title: "Run an End-to-End Snowflake Notebook Experiment"
categories: [AI/Data Science Lab]
tags: Snowflake Notebooks Experiment-Tracking Data-Science Snowpark-ML
author: Alan
summary: "A Snowflake Notebook lab for organizing an ML experiment with setup, profiling, training, metrics, decision checks, and cleanup."
level: Intermediate
permalink: /ai-data-science-lab/run-an-end-to-end-snowflake-notebook-experiment/
---

* content
{:toc}

Snowflake Notebooks are a natural place to combine SQL, Python, charts, and experiment notes. This lab shows a practical notebook structure for a small churn experiment: setup, profile data, train a model, store metrics, make a promotion decision, and clean up.

## Step 1: Create the notebook workspace

Run this as a SQL cell.

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.NOTEBOOK_EXP;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA NOTEBOOK_EXP;

CREATE OR REPLACE TABLE CHURN_EXPERIMENT_DATA (
  CUSTOMER_ID NUMBER,
  LOGINS_30D NUMBER,
  TICKETS_30D NUMBER,
  SPEND_30D NUMBER(10, 2),
  DAYS_SINCE_ACTIVITY NUMBER,
  CHURNED NUMBER
);

INSERT INTO CHURN_EXPERIMENT_DATA
SELECT * FROM VALUES
  (101, 4, 1, 75.00, 12, 1),
  (102, 9, 0, 145.00, 7, 0),
  (103, 1, 3, 0.00, 3, 1),
  (104, 5, 0, 80.00, 11, 0),
  (105, 6, 0, 190.00, 2, 0),
  (106, 0, 2, 20.00, 21, 1),
  (107, 8, 0, 240.00, 1, 0),
  (108, 2, 1, 40.00, 18, 1)
AS v (CUSTOMER_ID, LOGINS_30D, TICKETS_30D, SPEND_30D, DAYS_SINCE_ACTIVITY, CHURNED);
```

## Step 2: Profile the data

```sql
SELECT
  COUNT(*) AS ROW_COUNT,
  AVG(CHURNED) AS CHURN_RATE,
  AVG(LOGINS_30D) AS AVG_LOGINS,
  AVG(TICKETS_30D) AS AVG_TICKETS,
  AVG(SPEND_30D) AS AVG_SPEND
FROM CHURN_EXPERIMENT_DATA;

SELECT CHURNED, COUNT(*) AS ROW_COUNT
FROM CHURN_EXPERIMENT_DATA
GROUP BY CHURNED
ORDER BY CHURNED;
```

## Step 3: Train a baseline model

Run this as a Python cell.

```python
from snowflake.snowpark.context import get_active_session
from snowflake.ml.modeling.linear_model import LogisticRegression
from snowflake.ml.modeling.metrics import accuracy_score, f1_score

session = get_active_session()
df = session.table("AI_DS_LAB_DB.NOTEBOOK_EXP.CHURN_EXPERIMENT_DATA")

train_df = df.filter("MOD(ABS(HASH(CUSTOMER_ID)), 10) < 7")
test_df = df.filter("MOD(ABS(HASH(CUSTOMER_ID)), 10) >= 7")

features = ["LOGINS_30D", "TICKETS_30D", "SPEND_30D", "DAYS_SINCE_ACTIVITY"]

model = LogisticRegression(
    input_cols=features,
    label_cols=["CHURNED"],
    output_cols=["PREDICTED_CHURNED"],
)

model.fit(train_df)
predictions = model.predict(test_df)
predictions.write.mode("overwrite").save_as_table("AI_DS_LAB_DB.NOTEBOOK_EXP.CHURN_EXPERIMENT_PREDICTIONS")

metrics = {
    "accuracy": accuracy_score(predictions, "CHURNED", "PREDICTED_CHURNED"),
    "f1": f1_score(predictions, "CHURNED", "PREDICTED_CHURNED"),
}

metrics
```

## Step 4: Save experiment metadata

```sql
CREATE OR REPLACE TABLE EXPERIMENT_RUNS (
  RUN_ID STRING,
  MODEL_FAMILY STRING,
  FEATURE_SET STRING,
  ACCURACY FLOAT,
  F1_SCORE FLOAT,
  PROMOTION_DECISION STRING,
  RECORDED_AT TIMESTAMP_NTZ
);
```

```python
run_id = "churn-logistic-regression-v1"
decision = "PROMOTE" if metrics["f1"] >= 0.70 else "REVIEW"

session.create_dataframe(
    [[run_id, "LogisticRegression", ",".join(features), metrics["accuracy"], metrics["f1"], decision]],
    schema=["RUN_ID", "MODEL_FAMILY", "FEATURE_SET", "ACCURACY", "F1_SCORE", "PROMOTION_DECISION"],
).with_column("RECORDED_AT", session.sql("SELECT CURRENT_TIMESTAMP()").collect()[0][0]).write.mode("append").save_as_table(
    "AI_DS_LAB_DB.NOTEBOOK_EXP.EXPERIMENT_RUNS"
)
```

## Step 5: Review the decision

```sql
SELECT *
FROM EXPERIMENT_RUNS
ORDER BY RECORDED_AT DESC;

SELECT
  COUNT(*) AS SCORED_ROWS,
  COUNT_IF(CHURNED = PREDICTED_CHURNED) AS CORRECT_ROWS
FROM CHURN_EXPERIMENT_PREDICTIONS;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS EXPERIMENT_RUNS;
DROP TABLE IF EXISTS CHURN_EXPERIMENT_PREDICTIONS;
DROP TABLE IF EXISTS CHURN_EXPERIMENT_DATA;
```
