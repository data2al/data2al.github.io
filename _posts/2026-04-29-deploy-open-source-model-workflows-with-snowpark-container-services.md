---
layout: post
title: "Deploy Open Source Model Workflows With Snowpark Container Services"
categories: [AI/Data Science Lab]
tags: Snowflake Snowpark-Container-Services Model-Registry Open-Source-Models ML
author: Alan
summary: "A deployment-oriented lab showing how to package an open-source model workflow, register model metadata, evaluate inference logs, and clean up."
level: Advanced
permalink: /ai-data-science-lab/deploy-open-source-model-workflows-with-snowpark-container-services/
---

* content
{:toc}

Snowpark Container Services is useful when a model workflow needs custom packages, an API service, or runtime control beyond built-in SQL functions. This lab gives a compact deployment pattern: stage artifacts, define a service, log inference checks, and keep model metadata visible in Snowflake.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.SPCS_ML;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA SPCS_ML;

CREATE STAGE IF NOT EXISTS MODEL_ARTIFACTS;
```

## Step 2: Create sample inference requests

```sql
CREATE OR REPLACE TABLE INFERENCE_REQUESTS (
  REQUEST_ID NUMBER,
  REVIEW_TEXT STRING,
  EXPECTED_SENTIMENT STRING
);

INSERT INTO INFERENCE_REQUESTS
SELECT * FROM VALUES
  (1, 'The setup was fast and the Snowflake notebook ran without errors.', 'positive'),
  (2, 'The model endpoint timed out twice during the demo.', 'negative'),
  (3, 'The explanation was clear but the forecast should include holidays.', 'neutral')
AS v (REQUEST_ID, REVIEW_TEXT, EXPECTED_SENTIMENT);
```

## Step 3: Prepare a minimal service specification

Save this as `sentiment_service.yaml` before uploading it to the `MODEL_ARTIFACTS` stage. Replace the image name with the image you pushed to your Snowflake image repository.

```yaml
spec:
  containers:
    - name: sentiment-api
      image: /AI_DS_LAB_DB/SPCS_ML/IMAGE_REPO/sentiment-api:latest
      env:
        MODEL_NAME: sentiment-demo
      readinessProbe:
        port: 8000
        path: /health
  endpoints:
    - name: api
      port: 8000
      public: false
```

Upload the file and create the service.

```sql
PUT file://sentiment_service.yaml @MODEL_ARTIFACTS AUTO_COMPRESS = FALSE OVERWRITE = TRUE;

CREATE COMPUTE POOL IF NOT EXISTS AI_DS_POOL
  MIN_NODES = 1
  MAX_NODES = 1
  INSTANCE_FAMILY = CPU_X64_XS;

CREATE SERVICE IF NOT EXISTS SENTIMENT_SERVICE
  IN COMPUTE POOL AI_DS_POOL
  FROM @MODEL_ARTIFACTS
  SPEC = 'sentiment_service.yaml';

SHOW SERVICES LIKE 'SENTIMENT_SERVICE';
```

## Step 4: Log model metadata

Even when serving runs in a container, keep model ownership and evaluation metadata in Snowflake.

```sql
CREATE OR REPLACE TABLE MODEL_DEPLOYMENT_REGISTER (
  MODEL_NAME STRING,
  VERSION_NAME STRING,
  DEPLOYMENT_TARGET STRING,
  OWNER_ROLE STRING,
  METRIC_NAME STRING,
  METRIC_VALUE FLOAT,
  REGISTERED_AT TIMESTAMP_NTZ
);

INSERT INTO MODEL_DEPLOYMENT_REGISTER
SELECT
  'sentiment-demo',
  'v1',
  'Snowpark Container Services',
  CURRENT_ROLE(),
  'holdout_accuracy',
  0.91,
  CURRENT_TIMESTAMP();

SELECT * FROM MODEL_DEPLOYMENT_REGISTER;
```

## Step 5: Create inference evaluation checks

This demo table simulates service responses. In production, populate it from service logs or endpoint responses.

```sql
CREATE OR REPLACE TABLE INFERENCE_RESPONSES (
  REQUEST_ID NUMBER,
  PREDICTED_SENTIMENT STRING,
  LATENCY_MS NUMBER,
  MODEL_VERSION STRING
);

INSERT INTO INFERENCE_RESPONSES
SELECT * FROM VALUES
  (1, 'positive', 220, 'v1'),
  (2, 'negative', 340, 'v1'),
  (3, 'neutral', 260, 'v1')
AS v (REQUEST_ID, PREDICTED_SENTIMENT, LATENCY_MS, MODEL_VERSION);

CREATE OR REPLACE TABLE INFERENCE_EVAL AS
SELECT
  r.REQUEST_ID,
  r.EXPECTED_SENTIMENT,
  p.PREDICTED_SENTIMENT,
  IFF(r.EXPECTED_SENTIMENT = p.PREDICTED_SENTIMENT, 1, 0) AS MATCHED_EXPECTATION,
  p.LATENCY_MS,
  p.MODEL_VERSION
FROM INFERENCE_REQUESTS r
JOIN INFERENCE_RESPONSES p
  ON r.REQUEST_ID = p.REQUEST_ID;

SELECT
  AVG(MATCHED_EXPECTATION) AS ACCURACY,
  AVG(LATENCY_MS) AS AVG_LATENCY_MS,
  MAX(LATENCY_MS) AS MAX_LATENCY_MS
FROM INFERENCE_EVAL;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS INFERENCE_EVAL;
DROP TABLE IF EXISTS INFERENCE_RESPONSES;
DROP TABLE IF EXISTS MODEL_DEPLOYMENT_REGISTER;
DROP TABLE IF EXISTS INFERENCE_REQUESTS;
DROP SERVICE IF EXISTS SENTIMENT_SERVICE;
DROP COMPUTE POOL IF EXISTS AI_DS_POOL;
DROP STAGE IF EXISTS MODEL_ARTIFACTS;
```
