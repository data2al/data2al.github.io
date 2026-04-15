---
layout: post
title: "Build Running Totals With Window Functions"
categories: SQL
tags: SQL Window-Functions Time-Series Analytics
author: Alan
summary: "A clean cumulative-sum pattern for trend lines, balances, and progressive totals."
level: Intermediate
---

* content
{:toc}

Use this when a report needs a running total without collapsing rows.

## Example

```sql
select
    customer_id,
    transaction_date,
    amount,
    sum(amount) over (
        partition by customer_id
        order by transaction_date
        rows between unbounded preceding and current row
    ) as customer_running_total
from finance.transactions;
```

## Why this pattern helps

- keeps every transaction visible while adding cumulative context
- works well for balances, pacing, and cohort monitoring
- avoids self-joins that are harder to maintain

## Notes

- include an explicit frame for predictable behavior across dialects
- add a second sort key when multiple events share the same timestamp
- remove `partition by customer_id` when you need a single site-wide running total
