---
layout: post
title: "Use a CTE to Stage a Complex Query"
categories: SQL
tags: SQL CTE Analytics Warehousing
author: Alan
summary: "A readable SQL pattern for splitting one large transformation into named steps."
level: Beginner
---

* content
{:toc}

Use this when a query starts doing too much at once and needs a cleaner flow.

## Example

```sql
with sales_summary as (
    select
        product_id,
        sum(amount) as total_sales
    from mart.sales
    group by product_id
)
select
    p.product_name,
    s.total_sales
from dim.products p
join sales_summary s
    on p.product_id = s.product_id
where s.total_sales > 10000;
```

## Why this pattern helps

- gives each transformation step a name
- makes large queries easier to test and review
- keeps aggregation logic separate from final filtering

## Notes

- use CTE names that describe the business meaning, not just the operation
- stack multiple CTEs when a pipeline has clear stages
- check the warehouse optimizer if performance matters on very large queries
