---
layout: post
title: "Detect Missing Values in a Sequence"
categories: SQL
tags: SQL Window-Functions Data-Quality Validation
author: Alan
summary: "A sequence-gap check for invoice numbers, tickets, or any ordered identifier stream."
level: Intermediate
---

* content
{:toc}

Use this when identifiers should increase continuously and missing ranges need to be identified.

## Example

```sql
with sequenced_invoices as (
    select
        invoice_number,
        lead(invoice_number) over (order by invoice_number) as next_invoice_number
    from billing.invoices
)
select
    invoice_number,
    next_invoice_number,
    next_invoice_number - invoice_number - 1 as gap_size
from sequenced_invoices
where next_invoice_number - invoice_number > 1;
```

## Why this pattern helps

- quickly surfaces broken sequences in operational data
- identifies both the start of a gap and its size
- is easy to reuse in monitoring checks

## Notes

- sort by the true business sequence column, not a load timestamp
- add filters if each series should be checked separately by account or region
- expand the result into one row per missing value only if downstream users need that detail
