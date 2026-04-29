---
layout: post
title: "Train and Register a Snowpark ML Classification Model"
categories: [AI/Data Science Lab]
tags: Snowflake Snowpark ML Model-Registry Evaluation Classification
author: Alan
summary: "A Snowflake Notebook lab for training a churn classifier with Snowpark ML, evaluating predictions, registering the model, and cleaning up the demo."
level: Intermediate
permalink: /ai-data-science-lab/train-and-register-a-snowpark-ml-classification-model/
---

* content
{:toc}

This lab continues the churn scenario and shows the model workflow: train, score, evaluate, register, and monitor. Use a Snowflake Notebook with a Python runtime that includes Snowpark and Snowflake ML packages.

## Step 1: Create sample training data

Run this SQL cell first.

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.ML;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA ML;

CREATE OR REPLACE TABLE CUSTOMER_CHURN_FEATURES (
  CUSTOMER_ID NUMBER,
  EVENT_COUNT_30D NUMBER,
  SUPPORT_TICKETS_30D NUMBER,
  USAGE_EVENTS_30D NUMBER,
  BILLING_AMOUNT_30D NUMBER(10, 2),
  DAYS_SINCE_LAST_EVENT NUMBER,
  CHANNEL_COUNT_30D NUMBER,
  LABEL_CHURNED NUMBER
);

INSERT INTO CUSTOMER_CHURN_FEATURES
SELECT * FROM VALUES
  (101, 3, 1, 0, 75, 12, 3, 1),
  (102, 3, 0, 1, 120, 7, 3, 0),
  (103, 3, 2, 0, 0, 3, 3, 1),
  (104, 2, 0, 1, 0, 17, 2, 0),
  (105, 2, 0, 1, 0, 10, 2, 0),
  (106, 2, 1, 0, 40, 2, 2, 1),
  (107, 5, 0, 3, 250, 1, 3, 0),
  (108, 1, 1, 0, 0, 22, 1, 1),
  (109, 4, 0, 2, 180, 4, 3, 0),
  (110, 2, 2, 0, 20, 5, 2, 1)
AS v (
  CUSTOMER_ID,
  EVENT_COUNT_30D,
  SUPPORT_TICKETS_30D,
  USAGE_EVENTS_30D,
  BILLING_AMOUNT_30D,
  DAYS_SINCE_LAST_EVENT,
  CHANNEL_COUNT_30D,
  LABEL_CHURNED
);
```

## Step 2: Train a model in Python

Run this in a Python cell.

```python
from snowflake.snowpark.context import get_active_session
from snowflake.ml.modeling.ensemble import RandomForestClassifier
from snowflake.ml.modeling.metrics import accuracy_score, f1_score, precision_score, recall_score

session = get_active_session()

df = session.table("AI_DS_LAB_DB.ML.CUSTOMER_CHURN_FEATURES")
train_df = df.filter("MOD(ABS(HASH(CUSTOMER_ID)), 10) < 7")
test_df = df.filter("MOD(ABS(HASH(CUSTOMER_ID)), 10) >= 7")

feature_cols = [
    "EVENT_COUNT_30D",
    "SUPPORT_TICKETS_30D",
    "USAGE_EVENTS_30D",
    "BILLING_AMOUNT_30D",
    "DAYS_SINCE_LAST_EVENT",
    "CHANNEL_COUNT_30D",
]

model = RandomForestClassifier(
    input_cols=feature_cols,
    label_cols=["LABEL_CHURNED"],
    output_cols=["PREDICTED_CHURNED"],
    n_estimators=50,
    random_state=42,
)

model.fit(train_df)
predictions = model.predict(test_df)
predictions.write.mode("overwrite").save_as_table("AI_DS_LAB_DB.ML.CUSTOMER_CHURN_PREDICTIONS")
```

## Step 3: Evaluate the model

```python
predictions = session.table("AI_DS_LAB_DB.ML.CUSTOMER_CHURN_PREDICTIONS")

metrics = {
    "accuracy": accuracy_score(
        df=predictions,
        y_true_col_name="LABEL_CHURNED",
        y_pred_col_name="PREDICTED_CHURNED",
    ),
    "precision": precision_score(
        df=predictions,
        y_true_col_name="LABEL_CHURNED",
        y_pred_col_name="PREDICTED_CHURNED",
    ),
    "recall": recall_score(
        df=predictions,
        y_true_col_name="LABEL_CHURNED",
        y_pred_col_name="PREDICTED_CHURNED",
    ),
    "f1": f1_score(
        df=predictions,
        y_true_col_name="LABEL_CHURNED",
        y_pred_col_name="PREDICTED_CHURNED",
    ),
}

metrics
```

## Step 4: Store evaluation checks in Snowflake

```sql
CREATE OR REPLACE TABLE ML.CUSTOMER_CHURN_MODEL_CHECKS AS
SELECT
  CURRENT_TIMESTAMP() AS CHECKED_AT,
  COUNT(*) AS SCORED_ROWS,
  COUNT_IF(LABEL_CHURNED = PREDICTED_CHURNED) / NULLIF(COUNT(*), 0) AS ACCURACY,
  COUNT_IF(PREDICTED_CHURNED = 1) AS PREDICTED_CHURN_COUNT
FROM ML.CUSTOMER_CHURN_PREDICTIONS;

SELECT * FROM ML.CUSTOMER_CHURN_MODEL_CHECKS;
```

## Step 5: Register the model

```python
from snowflake.ml.registry import Registry

registry = Registry(
    session=session,
    database_name="AI_DS_LAB_DB",
    schema_name="ML",
)

model_version = registry.log_model(
    model=model,
    model_name="CUSTOMER_CHURN_CLASSIFIER",
    version_name="V1",
    sample_input_data=train_df.select(feature_cols).limit(5),
    metrics=metrics,
    comment="Demo churn classifier trained from Snowflake feature data.",
)

model_version.show_metrics()
```

## Step 6: Cleanup

```sql
DROP MODEL IF EXISTS ML.CUSTOMER_CHURN_CLASSIFIER;
DROP TABLE IF EXISTS ML.CUSTOMER_CHURN_MODEL_CHECKS;
DROP TABLE IF EXISTS ML.CUSTOMER_CHURN_PREDICTIONS;
DROP TABLE IF EXISTS ML.CUSTOMER_CHURN_FEATURES;
```
