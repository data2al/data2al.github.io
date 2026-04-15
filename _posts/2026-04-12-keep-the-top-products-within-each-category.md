---
layout: post
title: "Keep the Top Products Within Each Category"
categories: SQL
tags: SQL Window-Functions Ranking Merchandising
author: Alan
summary: "A top-n-per-group pattern for ranking products without mixing categories together."
level: Intermediate
---

* content
{:toc}

Use this when the ranking has to reset inside each business group.

## Example

```sql
with ranked_products as (
    select
        category,
        product_name,
        sum(sales_amount) as total_sales,
        dense_rank() over (
            partition by category
            order by sum(sales_amount) desc
        ) as sales_rank
    from mart.sales
    group by
        category,
        product_name
)
select
    category,
    product_name,
    total_sales
from ranked_products
where sales_rank <= 3
order by
    category,
    sales_rank,
    product_name;
```

## Why this pattern helps

- solves a common leaderboard requirement cleanly
- keeps ties inside the top band when business users expect that behavior
- scales to region, team, channel, or account-level ranking

## Notes

- switch to `row_number()` if you need exactly three rows per category
- include the rank column in the final output when users want ordering context
- check whether ties should be preserved or broken before publishing results
