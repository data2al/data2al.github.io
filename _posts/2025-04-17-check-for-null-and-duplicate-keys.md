---
layout: post
title: "Check For Null And Duplicate Keys"
categories: SQL
tags: SQL Data Quality Validation
author: Alan
summary: "A fast validation query for checking whether a model has null keys or duplicate identifiers."
level: Beginner
---

* content
{:toc}

This is a useful warehouse check before exposing a model to downstream dashboards, marts, or APIs.

## Example

```sql
select
    count(*) as total_rows,
    count_if(order_id is null) as null_order_ids,
    count(*) - count(distinct order_id) as duplicate_order_ids
from analytics.fct_orders;
```

## Why this pattern helps

- gives a quick signal on model integrity
- catches two common data contract failures in one query
- is easy to embed into testing or monitoring workflows

## Notes

- rename the key column to match the model you are validating
- schedule this check after transformations complete
- alert on non-zero results when the table is consumed by production reporting
