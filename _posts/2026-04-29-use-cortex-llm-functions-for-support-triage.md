---
layout: post
title: "Use Cortex LLM Functions for Support Triage"
categories: [AI/Data Science Lab]
tags: Snowflake Cortex LLM GenAI Evaluation SQL
author: Alan
summary: "A runnable Cortex AI lab that classifies support tickets, summarizes customer issues, evaluates output quality, and cleans up the demo."
level: Intermediate
permalink: /ai-data-science-lab/use-cortex-llm-functions-for-support-triage/
---

* content
{:toc}

This lab uses Snowflake Cortex LLM functions to classify and summarize support tickets. It focuses on practical Gen AI patterns: prompt design, structured output, repeatable scoring, and evaluation checks.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.GENAI;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA GENAI;
```

## Step 2: Create sample support tickets

```sql
CREATE OR REPLACE TABLE SUPPORT_TICKETS (
  TICKET_ID NUMBER,
  CUSTOMER_TIER STRING,
  TICKET_TEXT STRING,
  EXPECTED_CATEGORY STRING
);

INSERT INTO SUPPORT_TICKETS
SELECT * FROM VALUES
  (1, 'Enterprise', 'Our nightly billing export failed after the schema change. Finance needs the file before 8 AM.', 'data_pipeline'),
  (2, 'Business', 'The dashboard is showing stale numbers for the western region sales team.', 'analytics_quality'),
  (3, 'Enterprise', 'A user who left the company can still access a shared worksheet.', 'security_access'),
  (4, 'Starter', 'Can someone explain how to connect Python to Snowflake with key pair authentication?', 'how_to'),
  (5, 'Business', 'The query was fast yesterday but now scans a lot more partitions and costs more.', 'performance')
AS v (TICKET_ID, CUSTOMER_TIER, TICKET_TEXT, EXPECTED_CATEGORY);
```

## Step 3: Generate structured triage output

```sql
CREATE OR REPLACE TABLE SUPPORT_TRIAGE AS
SELECT
  TICKET_ID,
  CUSTOMER_TIER,
  EXPECTED_CATEGORY,
  TRY_PARSE_JSON(
    SNOWFLAKE.CORTEX.COMPLETE(
      'mistral-large2',
      'Classify the support ticket into one category: data_pipeline, analytics_quality, security_access, how_to, performance. ' ||
      'Return compact JSON with keys category, urgency, summary, next_action. Ticket: ' || TICKET_TEXT
    )
  ) AS TRIAGE_JSON
FROM SUPPORT_TICKETS;

SELECT
  TICKET_ID,
  TRIAGE_JSON:category::STRING AS CATEGORY,
  TRIAGE_JSON:urgency::STRING AS URGENCY,
  TRIAGE_JSON:summary::STRING AS SUMMARY,
  TRIAGE_JSON:next_action::STRING AS NEXT_ACTION
FROM SUPPORT_TRIAGE
ORDER BY TICKET_ID;
```

## Step 4: Add deterministic evaluation checks

```sql
CREATE OR REPLACE TABLE SUPPORT_TRIAGE_EVAL AS
SELECT
  TICKET_ID,
  EXPECTED_CATEGORY,
  TRIAGE_JSON:category::STRING AS PREDICTED_CATEGORY,
  IFF(LOWER(TRIAGE_JSON:category::STRING) = EXPECTED_CATEGORY, 1, 0) AS CATEGORY_MATCH,
  IFF(TRIAGE_JSON:summary::STRING IS NULL OR LENGTH(TRIAGE_JSON:summary::STRING) < 20, 1, 0) AS SUMMARY_TOO_SHORT,
  IFF(TRIAGE_JSON:next_action::STRING IS NULL, 1, 0) AS MISSING_NEXT_ACTION
FROM SUPPORT_TRIAGE;

SELECT
  COUNT(*) AS TICKET_COUNT,
  AVG(CATEGORY_MATCH) AS CATEGORY_ACCURACY,
  SUM(SUMMARY_TOO_SHORT) AS SHORT_SUMMARIES,
  SUM(MISSING_NEXT_ACTION) AS MISSING_ACTIONS
FROM SUPPORT_TRIAGE_EVAL;
```

## Step 5: Add an LLM-as-reviewer check

Use this check to flag weak summaries. Keep deterministic metrics as the main quality gate.

```sql
CREATE OR REPLACE TABLE SUPPORT_TRIAGE_REVIEW AS
SELECT
  t.TICKET_ID,
  SNOWFLAKE.CORTEX.COMPLETE(
    'mistral-large2',
    'Score this triage summary from 1 to 5 for usefulness. Return only an integer. ' ||
    'Ticket: ' || s.TICKET_TEXT ||
    ' Summary: ' || t.TRIAGE_JSON:summary::STRING ||
    ' Next action: ' || t.TRIAGE_JSON:next_action::STRING
  ) AS REVIEW_SCORE_TEXT
FROM SUPPORT_TRIAGE t
JOIN SUPPORT_TICKETS s
  ON t.TICKET_ID = s.TICKET_ID;

SELECT * FROM SUPPORT_TRIAGE_REVIEW ORDER BY TICKET_ID;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS SUPPORT_TRIAGE_REVIEW;
DROP TABLE IF EXISTS SUPPORT_TRIAGE_EVAL;
DROP TABLE IF EXISTS SUPPORT_TRIAGE;
DROP TABLE IF EXISTS SUPPORT_TICKETS;
```
