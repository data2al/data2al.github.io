---
layout: post
title: "Govern and Evaluate Gen AI Outputs in Snowflake"
categories: [AI/Data Science Lab]
tags: Snowflake GenAI Governance Cortex Evaluation Security
author: Alan
summary: "A lab for governing Gen AI prompts and outputs with role-aware inputs, masking, audit tables, quality checks, and cleanup."
level: Intermediate
permalink: /ai-data-science-lab/govern-and-evaluate-gen-ai-outputs-in-snowflake/
---

* content
{:toc}

Enterprise Gen AI work needs more than a good prompt. This lab shows a simple governance pattern for Snowflake AI workflows: keep approved prompts in tables, mask sensitive inputs, log outputs, and run quality checks before results are used downstream.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.GOVERNED_AI;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA GOVERNED_AI;
```

## Step 2: Create sample data and approved prompts

```sql
CREATE OR REPLACE TABLE CUSTOMER_NOTES (
  NOTE_ID NUMBER,
  CUSTOMER_EMAIL STRING,
  NOTE_TEXT STRING
);

INSERT INTO CUSTOMER_NOTES
SELECT * FROM VALUES
  (1, 'ava@example.com', 'Ava asked whether her warehouse should auto suspend because her demo costs increased.'),
  (2, 'ben@example.com', 'Ben reported that a departed contractor still has access to shared analytics.'),
  (3, 'cy@example.com', 'Cy wants a short explanation of why model metrics belong with model registry versions.')
AS v (NOTE_ID, CUSTOMER_EMAIL, NOTE_TEXT);

CREATE OR REPLACE TABLE APPROVED_PROMPTS (
  PROMPT_NAME STRING,
  PROMPT_TEMPLATE STRING,
  ACTIVE BOOLEAN
);

INSERT INTO APPROVED_PROMPTS
SELECT
  'customer_note_summary',
  'Summarize the customer note in one sentence. Do not include email addresses. Note: ',
  TRUE;
```

## Step 3: Create a masked input view

```sql
CREATE OR REPLACE VIEW SAFE_CUSTOMER_NOTES AS
SELECT
  NOTE_ID,
  REGEXP_REPLACE(CUSTOMER_EMAIL, '^[^@]+', 'redacted') AS CUSTOMER_EMAIL_MASKED,
  REGEXP_REPLACE(NOTE_TEXT, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '[redacted-email]') AS SAFE_NOTE_TEXT
FROM CUSTOMER_NOTES;
```

## Step 4: Generate governed outputs

```sql
CREATE OR REPLACE TABLE GENAI_OUTPUT_LOG AS
SELECT
  CURRENT_TIMESTAMP() AS RUN_AT,
  n.NOTE_ID,
  p.PROMPT_NAME,
  SNOWFLAKE.CORTEX.COMPLETE(
    'mistral-large2',
    p.PROMPT_TEMPLATE || n.SAFE_NOTE_TEXT
  ) AS GENERATED_SUMMARY
FROM SAFE_CUSTOMER_NOTES n
JOIN APPROVED_PROMPTS p
  ON p.PROMPT_NAME = 'customer_note_summary'
 AND p.ACTIVE = TRUE;

SELECT * FROM GENAI_OUTPUT_LOG ORDER BY NOTE_ID;
```

## Step 5: Run governance and quality checks

```sql
CREATE OR REPLACE TABLE GENAI_OUTPUT_CHECKS AS
SELECT
  NOTE_ID,
  GENERATED_SUMMARY,
  IFF(REGEXP_LIKE(GENERATED_SUMMARY, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'), 1, 0) AS LEAKED_EMAIL,
  IFF(LENGTH(GENERATED_SUMMARY) BETWEEN 20 AND 240, 1, 0) AS ACCEPTABLE_LENGTH,
  IFF(CONTAINS(LOWER(GENERATED_SUMMARY), 'snowflake') OR CONTAINS(LOWER(GENERATED_SUMMARY), 'warehouse') OR CONTAINS(LOWER(GENERATED_SUMMARY), 'access') OR CONTAINS(LOWER(GENERATED_SUMMARY), 'model'), 1, 0) AS DOMAIN_RELEVANT
FROM GENAI_OUTPUT_LOG;

SELECT
  COUNT(*) AS OUTPUT_COUNT,
  SUM(LEAKED_EMAIL) AS EMAIL_LEAKS,
  AVG(ACCEPTABLE_LENGTH) AS LENGTH_PASS_RATE,
  AVG(DOMAIN_RELEVANT) AS RELEVANCE_PASS_RATE
FROM GENAI_OUTPUT_CHECKS;
```

## Step 6: Add an audit-friendly approval table

```sql
CREATE OR REPLACE TABLE GENAI_OUTPUT_APPROVALS AS
SELECT
  NOTE_ID,
  GENERATED_SUMMARY,
  IFF(LEAKED_EMAIL = 0 AND ACCEPTABLE_LENGTH = 1 AND DOMAIN_RELEVANT = 1, 'APPROVED', 'REVIEW') AS REVIEW_STATUS,
  CURRENT_USER() AS REVIEWED_BY,
  CURRENT_TIMESTAMP() AS REVIEWED_AT
FROM GENAI_OUTPUT_CHECKS;

SELECT * FROM GENAI_OUTPUT_APPROVALS ORDER BY NOTE_ID;
```

## Step 7: Cleanup

```sql
DROP TABLE IF EXISTS GENAI_OUTPUT_APPROVALS;
DROP TABLE IF EXISTS GENAI_OUTPUT_CHECKS;
DROP TABLE IF EXISTS GENAI_OUTPUT_LOG;
DROP VIEW IF EXISTS SAFE_CUSTOMER_NOTES;
DROP TABLE IF EXISTS APPROVED_PROMPTS;
DROP TABLE IF EXISTS CUSTOMER_NOTES;
```
