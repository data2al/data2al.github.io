---
layout: post
title: "Practice Secure Data Sharing, Replication, and Failover"
categories: [Data Engineering Lab]
tags: Snowflake Sharing Replication Failover Governance
author: Alan
summary: "A lab for creating share-ready data, secure views, shares, and the syntax patterns for replication and failover groups."
level: Advanced
permalink: /data-engineering-lab/practice-secure-data-sharing-replication-and-failover/
---

* content
{:toc}

Secure sharing and replication show up in certification scenarios about cross-account collaboration, cross-region availability, and governed data products. Some steps require multiple accounts or Snowflake editions, but the local share objects and data product patterns are runnable.

## Step 1: Create the demo workspace

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE IF NOT EXISTS SHARE_LAB_WH
  WAREHOUSE_SIZE = XSMALL
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

CREATE DATABASE IF NOT EXISTS SHARE_LAB_DB;
CREATE SCHEMA IF NOT EXISTS SHARE_LAB_DB.PRODUCT;

USE WAREHOUSE SHARE_LAB_WH;
USE DATABASE SHARE_LAB_DB;
USE SCHEMA PRODUCT;
```

## Step 2: Create sample data

```sql
CREATE OR REPLACE TABLE PRODUCT.MONTHLY_REVENUE (
  MONTH_DATE DATE,
  REGION STRING,
  CUSTOMER_TIER STRING,
  NET_REVENUE NUMBER(12, 2)
);

INSERT INTO PRODUCT.MONTHLY_REVENUE
SELECT * FROM VALUES
  ('2026-01-01'::DATE, 'East', 'Gold',   12000.00),
  ('2026-01-01'::DATE, 'West', 'Silver',  8200.50),
  ('2026-02-01'::DATE, 'East', 'Gold',   13250.75),
  ('2026-02-01'::DATE, 'West', 'Silver',  9100.25)
AS v (MONTH_DATE, REGION, CUSTOMER_TIER, NET_REVENUE);
```

## Step 3: Create a secure view for sharing

```sql
CREATE OR REPLACE SECURE VIEW PRODUCT.SHARED_MONTHLY_REVENUE AS
SELECT
  MONTH_DATE,
  REGION,
  CUSTOMER_TIER,
  NET_REVENUE
FROM PRODUCT.MONTHLY_REVENUE
WHERE NET_REVENUE > 0;

SELECT *
FROM PRODUCT.SHARED_MONTHLY_REVENUE
ORDER BY MONTH_DATE, REGION;
```

## Step 4: Create a share

```sql
CREATE OR REPLACE SHARE SHARE_LAB_REVENUE_SHARE
  COMMENT = 'Demo secure share for Snowflake certification practice.';

GRANT USAGE ON DATABASE SHARE_LAB_DB TO SHARE SHARE_LAB_REVENUE_SHARE;
GRANT USAGE ON SCHEMA SHARE_LAB_DB.PRODUCT TO SHARE SHARE_LAB_REVENUE_SHARE;
GRANT SELECT ON VIEW SHARE_LAB_DB.PRODUCT.SHARED_MONTHLY_REVENUE TO SHARE SHARE_LAB_REVENUE_SHARE;

SHOW SHARES LIKE 'SHARE_LAB_REVENUE_SHARE';
SHOW GRANTS TO SHARE SHARE_LAB_REVENUE_SHARE;
```

To share with a real consumer, add their account. Do not run this placeholder.

```sql
-- ALTER SHARE SHARE_LAB_REVENUE_SHARE
--   ADD ACCOUNTS = <consumer_account_locator>;
```

## Step 5: Know the consumer-side shape

A consumer creates a database from an inbound share.

```sql
-- Consumer-side example only.
-- CREATE DATABASE PROVIDER_REVENUE_DB FROM SHARE <provider_account>.SHARE_LAB_REVENUE_SHARE;
```

## Step 6: Practice replication and failover syntax

Replication and failover require account-level configuration and supported editions. Use this syntax for recognition and run it only in a configured multi-account environment.

```sql
-- Example shape only.
-- CREATE REPLICATION GROUP REVENUE_REPLICATION_GROUP
--   OBJECT_TYPES = DATABASES
--   ALLOWED_DATABASES = SHARE_LAB_DB
--   ALLOWED_ACCOUNTS = myorg.secondary_account
--   REPLICATION_SCHEDULE = '10 MINUTE';

-- Example shape only.
-- CREATE FAILOVER GROUP REVENUE_FAILOVER_GROUP
--   OBJECT_TYPES = DATABASES, WAREHOUSES
--   ALLOWED_DATABASES = SHARE_LAB_DB
--   ALLOWED_WAREHOUSES = SHARE_LAB_WH
--   ALLOWED_ACCOUNTS = myorg.secondary_account
--   REPLICATION_SCHEDULE = '10 MINUTE';
```

## Step 7: Clean up

```sql
DROP SHARE IF EXISTS SHARE_LAB_REVENUE_SHARE;
DROP DATABASE IF EXISTS SHARE_LAB_DB;
DROP WAREHOUSE IF EXISTS SHARE_LAB_WH;
```

## Certification focus

Secure shares expose database objects without copying data. Secure views are common for governed shares. Replication and failover are for availability and cross-region recovery, not normal query acceleration.
