---
layout: post
title: "Compare Each Row to Its Group Average"
categories: SQL
tags: SQL Window-Functions Correlated-Subqueries Analytics
author: Alan
summary: "A practical pattern for flagging records that outperform or underperform their peer group."
level: Intermediate
---

* content
{:toc}

Use this when you need row-level output plus the average for the surrounding group.

## Example

```sql
select
    employee_name,
    department,
    salary
from (
    select
        employee_name,
        department,
        salary,
        avg(salary) over (partition by department) as department_avg_salary
    from hr.employees
) ranked_employees
where salary > department_avg_salary;
```

## Why this pattern helps

- preserves row detail while adding a group benchmark
- avoids a separate aggregate join in simple cases
- works for salary, margin, usage, and conversion comparisons

## Notes

- change the comparison to `<` to find underperforming rows
- keep the benchmark column in the final output if the report needs context
- use the same pattern with `sum()`, `min()`, or `max()` when needed
