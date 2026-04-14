---
layout: post
title: "Choose the Right Ranking Function for Ties"
categories: SQL
tags: SQL Window-Functions Ranking Analytics
author: Alan
summary: "A side-by-side ranking pattern for deciding between ROW_NUMBER, RANK, and DENSE_RANK."
level: Intermediate
---

* content
{:toc}

Use this when you need ranked output and the handling of ties changes the result.

## Example

```sql
select
    student_name,
    score,
    row_number() over (order by score desc) as row_num,
    rank() over (order by score desc) as score_rank,
    dense_rank() over (order by score desc) as dense_score_rank
from exam_results;
```

## Why this pattern helps

- shows tie behavior directly in one result set
- prevents accidental ranking bugs in leaderboards and reporting
- makes it easier to choose the right function before production use

## Notes

- use `row_number()` when every row must be unique
- use `rank()` when ties should create skipped positions
- use `dense_rank()` when ties should share a rank without gaps
