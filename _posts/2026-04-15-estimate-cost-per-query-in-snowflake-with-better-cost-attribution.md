---
layout: post
title: "Estimate Cost Per Query in Snowflake With Better Cost Attribution"
categories: ["Data Engineering"]
tags: Snowflake Cost-Optimization FinOps Query-History Warehouses SQL
author: Alan
summary: "A practical way to estimate Snowflake cost per query by allocating actual hourly warehouse credits instead of relying on execution time alone."
level: Advanced
permalink: /data-engineering-solutions/estimate-cost-per-query-in-snowflake-with-better-cost-attribution/
---

* content
{:toc}

Snowflake tells you what each warehouse cost, but it does not directly tell you what each query cost. That gap matters when you are trying to find the dashboard, dbt model, or ad hoc workflow that is quietly driving spend.

The tempting answer is to multiply query runtime by the warehouse's hourly rate. That is easy to explain, but it is not how Snowflake bills. Warehouses are billed for the time they are running, including idle time, and concurrent queries share the same active compute. If you want a per-query model that is directionally useful for optimization, you need a better allocation method.

This article walks through a practical approach: start from the actual warehouse credits billed each hour, then allocate those credits across the queries that consumed time during that same hour.

## Why the simple method breaks down

A basic estimate looks like this:

```text
query_cost = execution_hours * warehouse_credits_per_hour * credit_price
```

That works as a rough back-of-the-envelope check, but it misses several important realities:

- a 6-second query can wake a warehouse and effectively trigger a much larger billed window
- two 20-minute queries running at the same time do not create 40 billable query-minutes
- a long idle gap after a query still belongs somewhere if you want totals to reconcile to warehouse spend

So if the goal is just a quick estimate, runtime times warehouse rate is fine. If the goal is to identify where optimization work will save money, it is usually too naive.

## A more reliable model

The stronger pattern is:

1. take hourly warehouse credits from `snowflake.account_usage.warehouse_metering_history`
2. measure how long each query actually ran within each billed hour
3. allocate that hour's credits in proportion to each query's share of execution time
4. sum the hourly allocations back to one row per query

This does two useful things at once:

- it keeps the total attributed query cost aligned with real warehouse charges
- it naturally accounts for both concurrency and idle time inside the hour

For example, if one warehouse used 12 credits between 2 PM and 3 PM, and the queries in that hour contributed 10, 20, and 30 minutes of execution time, then those three queries should receive one-sixth, one-third, and one-half of the hourly credits.

## Step 1: isolate warehouse-backed queries

Start with `query_history`, but ignore records that never ran on a warehouse. You also want a more accurate execution start timestamp, because queueing and compilation time happen before warehouse execution begins.

```sql
with base_queries as (
    select
        query_id,
        query_text,
        warehouse_id,
        warehouse_name,
        warehouse_size,
        start_time,
        end_time,
        timeadd(
            'millisecond',
            coalesce(queued_overload_time, 0)
            + coalesce(compilation_time, 0)
            + coalesce(queued_provisioning_time, 0)
            + coalesce(queued_repair_time, 0)
            + coalesce(list_external_files_time, 0),
            start_time
        ) as execution_start_time
    from snowflake.account_usage.query_history
    where warehouse_size is not null
      and start_time >= dateadd(day, -30, current_timestamp())
)
```

That `execution_start_time` matters. If you allocate cost using raw `start_time`, you will overstate the amount of time a query spent consuming warehouse compute.

## Step 2: split queries across billing hours

Warehouse metering is hourly, so query time has to be expressed the same way. A query that begins at `08:55` and finishes at `09:07` needs to be split across two hourly buckets.

One practical approach is to generate a list of hours for the reporting window and join queries to every hour they overlap.

```sql
with hours as (
    select
        dateadd(
            hour,
            -seq4(),
            date_trunc('hour', current_timestamp())
        ) as hour_start
    from table(generator(rowcount => 24 * 31))
),
query_hours as (
    select
        h.hour_start,
        dateadd(hour, 1, h.hour_start) as hour_end,
        q.query_id,
        q.query_text,
        q.warehouse_id,
        q.warehouse_name,
        q.warehouse_size,
        q.execution_start_time,
        q.end_time
    from hours h
    join base_queries q
      on h.hour_start < q.end_time
     and dateadd(hour, 1, h.hour_start) > q.execution_start_time
)
```

At this point you have one row for each query-hour overlap instead of one row per query.

## Step 3: measure execution time inside each hour

Now compute how much of the query ran inside the hour and what fraction of that warehouse-hour it represents.

```sql
with query_time_by_hour as (
    select
        hour_start,
        warehouse_id,
        query_id,
        query_text,
        warehouse_name,
        warehouse_size,
        datediff(
            millisecond,
            greatest(execution_start_time, hour_start),
            least(end_time, hour_end)
        ) as query_ms_in_hour
    from query_hours
),
hourly_shares as (
    select
        *,
        sum(query_ms_in_hour) over (
            partition by warehouse_id, hour_start
        ) as total_query_ms_in_hour,
        query_ms_in_hour
        / nullif(sum(query_ms_in_hour) over (
            partition by warehouse_id, hour_start
        ), 0) as hour_fraction
    from query_time_by_hour
)
```

This is the key idea. You are not asking, "How expensive was this query in isolation?" You are asking, "What share of this billed warehouse-hour should this query own?"

## Step 4: allocate actual credits

Now bring in the warehouse credits that Snowflake actually billed and allocate them using the hourly fraction you just calculated.

```sql
with metered_hours as (
    select
        start_time as hour_start,
        warehouse_id,
        credits_used_compute
    from snowflake.account_usage.warehouse_metering_history
    where start_time >= dateadd(day, -30, current_timestamp())
),
allocated_query_cost as (
    select
        s.query_id,
        s.query_text,
        s.warehouse_id,
        s.warehouse_name,
        s.warehouse_size,
        s.hour_start,
        s.query_ms_in_hour,
        s.hour_fraction,
        m.credits_used_compute * s.hour_fraction as allocated_credits
    from hourly_shares s
    join metered_hours m
      on s.warehouse_id = m.warehouse_id
     and s.hour_start = m.hour_start
)
select
    query_id,
    any_value(query_text) as query_text,
    any_value(warehouse_name) as warehouse_name,
    any_value(warehouse_size) as warehouse_size,
    sum(query_ms_in_hour) / 1000 as execution_seconds,
    sum(allocated_credits) as query_credits
from allocated_query_cost
group by query_id;
```

If you want dollar cost instead of credits, multiply `allocated_credits` by your contract's credit price in a final select.

## Clean the query text before grouping

Cost by `query_id` is useful, but cost by logical workload is where this becomes operational. The challenge is that many tools inject unique comments into SQL text, so repeated executions of the same underlying query may all look different.

Common examples:

- BI tools append query context as comments
- dbt injects JSON metadata like `invocation_id` and model references
- parameterized SQL resolves to different literal values on every run

At minimum, remove comments before creating a query signature:

```sql
select
    query_id,
    regexp_replace(
        regexp_replace(query_text, '(/\\*.*\\*/)', ''),
        '(--.*$)|(--.*\\n)',
        ''
    ) as normalized_query_text
from snowflake.account_usage.query_history;
```

From there, you can hash the cleaned SQL and aggregate spend by normalized query text instead of raw text:

```sql
select
    md5(normalized_query_text) as query_signature,
    sum(query_credits) as total_query_credits,
    count(*) as executions,
    avg(execution_seconds) as avg_execution_seconds
from query_history_enriched
group by 1
order by total_query_credits desc;
```

This is often the difference between seeing thousands of noisy one-off statements and seeing one expensive dashboard, one incremental model, or one recurring transformation pipeline.

## How to use the output

Once the enriched table exists, you can answer much better questions:

- which repeated workload consumed the most credits in the last 30 days
- which dashboards or dbt models have the highest annualized cost
- whether spend is driven by runtime, execution frequency, or warehouse choice
- which query families are worth rewriting, rescheduling, or isolating

In practice, the biggest value is prioritization. You do not need a mathematically perfect model to reduce spend. You need a model that reliably points you to the highest-leverage work.

## Limitations to keep in mind

This method is far better than simple runtime multiplication, but it is still a model, not a perfect ledger.

- idle time is spread across queries in the hour, even though one query may have been the real trigger for warehouse resume or prolonged inactivity
- Snowflake's 60-second minimum billing per resume is not explicitly assigned to the query that caused it
- comment stripping helps, but queries with changing literals, dates, or parameter values may still fragment into multiple signatures
- cloud services charges are not fully represented when the relevant work did not execute on a warehouse

Those caveats matter, but they do not make the model unusable. They simply define how precise you should claim it to be.

## Final takeaway

If you want a quick estimate, use runtime times warehouse rate. If you want a practical cost-attribution model that better matches Snowflake billing behavior, allocate actual hourly warehouse credits across the queries that consumed time in that hour.

That approach is much more useful for real optimization work because it handles concurrency, partially captures idle cost, and rolls up cleanly into the workloads teams can actually improve.

Source inspiration: [Calculating cost per query in Snowflake](https://select.dev/posts/cost-per-query) by Ian Whitestone on SELECT.
