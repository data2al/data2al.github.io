---
layout: post
title: "Pivot Rows Into Reporting Columns"
categories: SQL
tags: SQL Aggregation Reporting Analytics
author: Alan
summary: "A conditional-aggregation pattern for turning row values into side-by-side reporting columns."
level: Intermediate
---

* content
{:toc}

Use this when downstream users want a report-shaped result instead of normalized rows.

## Example

```sql
select
    product_name,
    sum(case when extract(month from sale_date) = 1 then amount else 0 end) as jan_sales,
    sum(case when extract(month from sale_date) = 2 then amount else 0 end) as feb_sales,
    sum(case when extract(month from sale_date) = 3 then amount else 0 end) as mar_sales
from mart.sales
group by product_name;
```

## Why this pattern helps

- works in almost every SQL dialect
- keeps pivot logic explicit and easy to review
- is useful for dashboards, exports, and finance summaries

## Notes

- rename the buckets to match real reporting periods
- use a date dimension join when periods are based on fiscal calendars
- switch to native `pivot` syntax only if the warehouse supports it and the team uses it as the standard pattern
