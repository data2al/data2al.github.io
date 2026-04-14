---
layout: post
title: "Deduplicate Rows With Row Number"
categories: SQL
tags: SQL Data Quality Warehousing
author: Alan
summary: "A warehouse-friendly SQL pattern for keeping the latest record per business key."
level: Beginner
---

* content
{:toc}

Use this when ingestion or upstream systems can resend the same business event more than once.

## Example

```sql
with ranked_events as (
    select
        event_id,
        customer_id,
        event_timestamp,
        payload,
        row_number() over (
            partition by event_id
            order by event_timestamp desc
        ) as row_num
    from raw.customer_events
)
select
    event_id,
    customer_id,
    event_timestamp,
    payload
from ranked_events
where row_num = 1;
```

## Why this pattern helps

- removes duplicate records deterministically
- keeps the query easy to adapt for staging models
- works well in warehouses that support window functions efficiently

## Notes

- choose an ordering column that reflects the latest valid version of a row
- use additional tie-breakers if timestamps are not unique
- test the deduped result against known duplicate cases
