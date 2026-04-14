---
layout: post
title: "Find Customers Active in Consecutive Months"
categories: SQL
tags: SQL Window-Functions Retention Time-Series
author: Alan
summary: "A retention-style query for identifying customers who returned in back-to-back months."
level: Intermediate
---

* content
{:toc}

Use this when you need a simple monthly continuity or retention signal.

## Example

```sql
with monthly_activity as (
    select
        customer_id,
        date_trunc('month', purchase_date) as purchase_month,
        lag(date_trunc('month', purchase_date)) over (
            partition by customer_id
            order by date_trunc('month', purchase_date)
        ) as previous_purchase_month
    from commerce.purchases
    group by
        customer_id,
        date_trunc('month', purchase_date)
)
select distinct
    customer_id
from monthly_activity
where purchase_month = previous_purchase_month + interval '1 month';
```

## Why this pattern helps

- gives a fast retention signal without a full cohort model
- removes duplicate purchases within the same month
- extends naturally to churn or streak analysis

## Notes

- keep the month-level grouping so multiple purchases in one month do not distort the result
- select both months when inspection of the transition periods is needed
- adapt the interval for weekly or quarterly continuity checks
