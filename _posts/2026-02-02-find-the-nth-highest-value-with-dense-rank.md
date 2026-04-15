---
layout: post
title: "Find the Nth Highest Value With Dense Rank"
categories: SQL
tags: SQL Window-Functions Ranking Interview-Patterns
author: Alan
summary: "A durable pattern for returning the nth highest value while handling ties correctly."
level: Intermediate
---

* content
{:toc}

Use this when the business question is about the nth highest value rather than the nth physical row.

## Example

```sql
with ranked_salaries as (
    select
        employee_id,
        salary,
        dense_rank() over (order by salary desc) as salary_rank
    from hr.employees
)
select
    employee_id,
    salary
from ranked_salaries
where salary_rank = 3;
```

## Why this pattern helps

- handles ties without dropping valid rows
- is easier to explain than nested `max()` logic
- adapts cleanly to top-n and per-group ranking problems

## Notes

- replace `3` with any target rank you need
- add `partition by department_id` to find the nth highest value within a group
- use `row_number()` instead when you truly need the nth row only
