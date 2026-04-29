---
layout: post
title: "Extract Structured Fields From Documents With Cortex"
categories: [AI/Data Science Lab]
tags: Snowflake Cortex Document-Extraction GenAI Evaluation SQL
author: Alan
summary: "A document-style Gen AI lab that extracts invoice fields from sample text, validates structured JSON, checks accuracy, and cleans up."
level: Intermediate
permalink: /ai-data-science-lab/extract-structured-fields-from-documents-with-cortex/
---

* content
{:toc}

Many Gen AI workflows turn unstructured text into governed structured data. This lab uses invoice-like sample text, Cortex LLM extraction, JSON validation, field-level checks, and cleanup. The same evaluation pattern applies whether the source is pasted text, staged files, OCR output, or a document processing service.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.DOC_AI;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA DOC_AI;
```

## Step 2: Create sample document text

```sql
CREATE OR REPLACE TABLE INVOICE_TEXT (
  DOC_ID NUMBER,
  DOC_TEXT STRING,
  EXPECTED_VENDOR STRING,
  EXPECTED_TOTAL NUMBER(10, 2)
);

INSERT INTO INVOICE_TEXT
SELECT * FROM VALUES
  (1, 'Invoice INV-1001 from Northwind Analytics. Invoice date 2026-04-01. Total due is $1250.50. Payment terms net 30.', 'Northwind Analytics', 1250.50),
  (2, 'Supplier: Contoso Data Services. Invoice number C-778. Date: 2026-04-03. Amount due: $840.00. Terms: net 15.', 'Contoso Data Services', 840.00),
  (3, 'Vendor Alpine AI Labs issued invoice AAI-42 on 2026-04-05 for total $2199.99. Due on receipt.', 'Alpine AI Labs', 2199.99)
AS v (DOC_ID, DOC_TEXT, EXPECTED_VENDOR, EXPECTED_TOTAL);
```

## Step 3: Extract structured JSON

```sql
CREATE OR REPLACE TABLE INVOICE_EXTRACTS AS
SELECT
  DOC_ID,
  EXPECTED_VENDOR,
  EXPECTED_TOTAL,
  TRY_PARSE_JSON(
    SNOWFLAKE.CORTEX.COMPLETE(
      'mistral-large2',
      'Extract invoice fields as compact JSON with keys vendor, invoice_number, invoice_date, total_amount, payment_terms. ' ||
      'Use null for unknown fields. Document: ' || DOC_TEXT
    )
  ) AS EXTRACT_JSON
FROM INVOICE_TEXT;

SELECT
  DOC_ID,
  EXTRACT_JSON:vendor::STRING AS VENDOR,
  EXTRACT_JSON:invoice_number::STRING AS INVOICE_NUMBER,
  EXTRACT_JSON:invoice_date::STRING AS INVOICE_DATE,
  EXTRACT_JSON:total_amount::FLOAT AS TOTAL_AMOUNT,
  EXTRACT_JSON:payment_terms::STRING AS PAYMENT_TERMS
FROM INVOICE_EXTRACTS
ORDER BY DOC_ID;
```

## Step 4: Validate extraction quality

```sql
CREATE OR REPLACE TABLE INVOICE_EXTRACT_EVAL AS
SELECT
  DOC_ID,
  EXPECTED_VENDOR,
  EXTRACT_JSON:vendor::STRING AS EXTRACTED_VENDOR,
  EXPECTED_TOTAL,
  EXTRACT_JSON:total_amount::FLOAT AS EXTRACTED_TOTAL,
  IFF(LOWER(EXTRACT_JSON:vendor::STRING) = LOWER(EXPECTED_VENDOR), 1, 0) AS VENDOR_MATCH,
  IFF(ABS(EXTRACT_JSON:total_amount::FLOAT - EXPECTED_TOTAL) < 0.01, 1, 0) AS TOTAL_MATCH,
  IFF(EXTRACT_JSON:invoice_date::STRING IS NULL, 1, 0) AS MISSING_DATE
FROM INVOICE_EXTRACTS;

SELECT
  COUNT(*) AS DOC_COUNT,
  AVG(VENDOR_MATCH) AS VENDOR_MATCH_RATE,
  AVG(TOTAL_MATCH) AS TOTAL_MATCH_RATE,
  SUM(MISSING_DATE) AS MISSING_DATES
FROM INVOICE_EXTRACT_EVAL;
```

## Step 5: Create a review queue

```sql
CREATE OR REPLACE TABLE INVOICE_REVIEW_QUEUE AS
SELECT
  DOC_ID,
  EXTRACTED_VENDOR,
  EXTRACTED_TOTAL,
  CASE
    WHEN VENDOR_MATCH = 1 AND TOTAL_MATCH = 1 AND MISSING_DATE = 0 THEN 'APPROVED'
    ELSE 'REVIEW'
  END AS REVIEW_STATUS
FROM INVOICE_EXTRACT_EVAL;

SELECT * FROM INVOICE_REVIEW_QUEUE ORDER BY DOC_ID;
```

## Step 6: Cleanup

```sql
DROP TABLE IF EXISTS INVOICE_REVIEW_QUEUE;
DROP TABLE IF EXISTS INVOICE_EXTRACT_EVAL;
DROP TABLE IF EXISTS INVOICE_EXTRACTS;
DROP TABLE IF EXISTS INVOICE_TEXT;
```
