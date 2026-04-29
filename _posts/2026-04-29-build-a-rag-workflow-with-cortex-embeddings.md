---
layout: post
title: "Build a RAG Workflow With Cortex Embeddings"
categories: [AI/Data Science Lab]
tags: Snowflake Cortex Embeddings RAG Vector-Search GenAI
author: Alan
summary: "A retrieval-augmented generation lab using Snowflake Cortex embeddings, vector similarity, answer generation, quality checks, and cleanup."
level: Intermediate
permalink: /ai-data-science-lab/build-a-rag-workflow-with-cortex-embeddings/
---

* content
{:toc}

Retrieval-augmented generation keeps LLM answers grounded in approved content. This lab builds a small knowledge base, embeds it in Snowflake, retrieves relevant context, generates answers, and checks whether answers cite the expected source.

## Step 1: Create the lab workspace

```sql
USE ROLE ACCOUNTADMIN;
CREATE WAREHOUSE IF NOT EXISTS AI_DS_LAB_WH WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS AI_DS_LAB_DB;
CREATE SCHEMA IF NOT EXISTS AI_DS_LAB_DB.RAG;

USE WAREHOUSE AI_DS_LAB_WH;
USE DATABASE AI_DS_LAB_DB;
USE SCHEMA RAG;
```

## Step 2: Create sample knowledge base content

```sql
CREATE OR REPLACE TABLE KB_CHUNKS (
  CHUNK_ID NUMBER,
  DOC_NAME STRING,
  CHUNK_TEXT STRING
);

INSERT INTO KB_CHUNKS
SELECT * FROM VALUES
  (1, 'warehouse_policy', 'Use XSMALL warehouses for demos and development. Enable auto suspend at 60 seconds to control cost.'),
  (2, 'access_policy', 'Use role-based access control. Grant the least privilege needed and review future grants before production use.'),
  (3, 'cortex_policy', 'Do not send regulated secrets to LLM prompts. Use masked views and approved prompt tables for Gen AI workflows.'),
  (4, 'model_policy', 'Register production models with version names, metrics, sample input data, owners, and approval comments.'),
  (5, 'rag_policy', 'RAG answers must include source document names and should refuse when retrieved context is not relevant.')
AS v (CHUNK_ID, DOC_NAME, CHUNK_TEXT);
```

## Step 3: Embed the content

```sql
CREATE OR REPLACE TABLE KB_EMBEDDINGS AS
SELECT
  CHUNK_ID,
  DOC_NAME,
  CHUNK_TEXT,
  SNOWFLAKE.CORTEX.EMBED_TEXT_768('e5-base-v2', CHUNK_TEXT) AS CHUNK_VECTOR
FROM KB_CHUNKS;
```

## Step 4: Retrieve context for a question

```sql
SET QUESTION = 'How should I control cost for a development warehouse?';

CREATE OR REPLACE TEMP TABLE QUESTION_VECTOR AS
SELECT
  $QUESTION AS QUESTION,
  SNOWFLAKE.CORTEX.EMBED_TEXT_768('e5-base-v2', $QUESTION) AS QUESTION_VECTOR;

CREATE OR REPLACE TABLE RAG_CONTEXT AS
SELECT
  k.CHUNK_ID,
  k.DOC_NAME,
  k.CHUNK_TEXT,
  VECTOR_COSINE_SIMILARITY(k.CHUNK_VECTOR, q.QUESTION_VECTOR) AS SIMILARITY
FROM KB_EMBEDDINGS k
CROSS JOIN QUESTION_VECTOR q
ORDER BY SIMILARITY DESC
LIMIT 3;

SELECT * FROM RAG_CONTEXT ORDER BY SIMILARITY DESC;
```

## Step 5: Generate a grounded answer

```sql
CREATE OR REPLACE TABLE RAG_ANSWER AS
WITH context_text AS (
  SELECT LISTAGG('[' || DOC_NAME || '] ' || CHUNK_TEXT, '\n') AS CONTEXT_BLOCK
  FROM RAG_CONTEXT
)
SELECT
  $QUESTION AS QUESTION,
  SNOWFLAKE.CORTEX.COMPLETE(
    'mistral-large2',
    'Answer the question using only the context. Include source document names in brackets. ' ||
    'If the context is not enough, say the context is not enough.' ||
    '\nQuestion: ' || $QUESTION ||
    '\nContext:\n' || CONTEXT_BLOCK
  ) AS ANSWER
FROM context_text;

SELECT * FROM RAG_ANSWER;
```

## Step 6: Run evaluation checks

```sql
CREATE OR REPLACE TABLE RAG_EVAL AS
SELECT
  a.QUESTION,
  a.ANSWER,
  IFF(CONTAINS(LOWER(a.ANSWER), 'warehouse_policy'), 1, 0) AS CITES_EXPECTED_SOURCE,
  IFF(CONTAINS(LOWER(a.ANSWER), 'auto suspend') OR CONTAINS(LOWER(a.ANSWER), '60 seconds'), 1, 0) AS USES_RETRIEVED_FACT,
  (SELECT MAX(SIMILARITY) FROM RAG_CONTEXT) AS TOP_SIMILARITY
FROM RAG_ANSWER a;

SELECT * FROM RAG_EVAL;
```

## Step 7: Cleanup

```sql
DROP TABLE IF EXISTS RAG_EVAL;
DROP TABLE IF EXISTS RAG_ANSWER;
DROP TABLE IF EXISTS RAG_CONTEXT;
DROP TABLE IF EXISTS KB_EMBEDDINGS;
DROP TABLE IF EXISTS KB_CHUNKS;
```
