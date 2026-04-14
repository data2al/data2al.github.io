---
layout: post
title: "Standardize Text Values With SQL String Functions"
categories: SQL
tags: SQL String-Functions Data-Cleanup Validation
author: Alan
summary: "A lightweight cleanup pattern for normalizing free-text fields before analysis."
level: Beginner
---

* content
{:toc}

Use this when raw text values need trimming, case normalization, and simple replacement before joining or reporting.

## Example

```sql
select
    customer_id,
    trim(customer_name) as cleaned_customer_name,
    upper(trim(state_code)) as standardized_state_code,
    replace(lower(email_address), ' ', '') as normalized_email_address,
    length(trim(customer_name)) as cleaned_name_length
from raw.customers;
```

## Why this pattern helps

- reduces preventable mismatches in joins and filters
- keeps cleanup logic close to the consuming model
- turns inconsistent text into reporting-friendly values quickly

## Notes

- upstream fixes are more durable for persistent data quality problems
- keep replacement rules small and obvious in SQL models
- move heavier parsing into a dedicated cleaning layer when complexity grows
