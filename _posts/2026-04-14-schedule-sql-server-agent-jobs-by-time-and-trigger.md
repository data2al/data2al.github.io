---
layout: post
title: "Schedule SQL Server Agent Jobs by Time and Trigger"
categories: ["Data Engineering"]
tags: SQL-Server SQL-Agent Scheduling Automation Operations
author: Alan
summary: "A SQL Server Agent guide for time-based schedules, trigger-driven job starts, and separating scheduling from job logic."
level: Intermediate
permalink: /data-engineering-solutions/schedule-sql-server-agent-jobs-by-time-and-trigger/
---

* content
{:toc}

SQL Server Agent is the scheduling layer that turns manual database operations into repeatable jobs. In data engineering work, that often means:

- running stored procedures on a schedule
- refreshing staging or reporting tables
- chaining operational tasks together
- surfacing failures in a way support teams can act on

A common pattern is to keep business logic in stored procedures and keep the SQL Agent job itself thin. That allows the procedure to be tested directly while the Agent handles timing and execution.

## Keep job steps small

A SQL Agent job step is often just a call into the real load logic.

```sql
exec dbo.usp_load_sales_snapshot;
```

If the procedure already handles transactions, row counts, logging, and `throw`, the job step can remain simple.

## Schedule a job on a time-based cadence

Time-based schedules are the most common SQL Server Agent pattern. They are predictable and easy to support.

Typical examples:

- every 15 minutes for incremental loads
- nightly for full refresh jobs
- hourly for sync processes between systems

## Example: create a SQL Agent job and run it every hour

```sql
use msdb;
go

exec dbo.sp_add_job
    @job_name = N'Load Sales Snapshot',
    @enabled = 1,
    @description = N'Runs the sales snapshot load procedure every hour.';
go

exec dbo.sp_add_jobstep
    @job_name = N'Load Sales Snapshot',
    @step_name = N'Execute load procedure',
    @subsystem = N'TSQL',
    @database_name = N'YourDatabaseName',
    @command = N'exec dbo.usp_load_sales_snapshot;';
go

exec dbo.sp_add_schedule
    @schedule_name = N'Hourly Sales Snapshot Schedule',
    @enabled = 1,
    @freq_type = 4,
    @freq_interval = 1,
    @freq_subday_type = 8,
    @freq_subday_interval = 1,
    @active_start_time = 000000;
go

exec dbo.sp_attach_schedule
    @job_name = N'Load Sales Snapshot',
    @schedule_name = N'Hourly Sales Snapshot Schedule';
go

exec dbo.sp_add_jobserver
    @job_name = N'Load Sales Snapshot';
go
```

## What the time-based schedule is doing

- `sp_add_job` creates the job container
- `sp_add_jobstep` defines the T-SQL the job will run
- `sp_add_schedule` defines when it runs
- `sp_attach_schedule` connects the schedule to the job
- `sp_add_jobserver` assigns the job to the current SQL Server Agent

In the schedule definition:

- `@freq_type = 4` means daily
- `@freq_interval = 1` means every day
- `@freq_subday_type = 8` means hours
- `@freq_subday_interval = 1` means every 1 hour

That combination gives you an hourly schedule across the day.

## Trigger a job from a table event

Sometimes you do not want to wait for the next scheduled run. If a table changes, you may want to start a downstream job right away.

This is where teams often place full ETL logic directly in a trigger. A more controlled pattern is:

1. let the trigger stay very small
2. use it to start a SQL Agent job or write a queue record
3. let the job run the actual stored procedure

## Example: start a SQL Agent job from a trigger

```sql
create or alter trigger dbo.trg_start_customer_sync_job
on dbo.customer_changes
after insert
as
begin
    set nocount on;

    if exists (select 1 from inserted)
    begin
        exec msdb.dbo.sp_start_job
            @job_name = N'Sync Customer Warehouse Data';
    end
end;
go
```

## Why this trigger-driven pattern is more controlled than embedding ETL in the trigger

- the trigger stays short
- the real load still lives in a stored procedure or job step
- SQL Agent history can show whether the downstream job succeeded or failed

## Important cautions for trigger-based scheduling

Trigger-started jobs can be useful, but they need care:

- a high-volume table can fire the trigger many times
- repeated `sp_start_job` calls can overlap if the job is already running
- hidden automation can make debugging harder

This pattern is most appropriate when:

- the job is idempotent
- the trigger fires at a manageable rate
- the downstream process can tolerate duplicate start attempts

## Queue-based variation

If you need event-driven behavior but want more control, write a queue row from the trigger and let a scheduled Agent job poll that queue.

```sql
create or alter trigger dbo.trg_queue_customer_sync
on dbo.customer_changes
after insert
as
begin
    set nocount on;

    insert into dbo.job_request_queue (
        job_name,
        requested_at
    )
    select
        'Sync Customer Warehouse Data',
        sysdatetime()
    from inserted;
end;
go
```

Then the SQL Agent job can check the queue table every few minutes:

```sql
if exists (
    select 1
    from dbo.job_request_queue
    where job_name = 'Sync Customer Warehouse Data'
)
begin
    exec dbo.usp_sync_customer_warehouse_data;
end;
```

This pattern provides more control because:

- requests are visible in a table
- duplicate events can be deduplicated
- the scheduler stays predictable

## When to use time-based schedules vs trigger-based starts

Use time-based schedules when:

- freshness requirements are measured in minutes or hours
- predictability matters more than instant execution
- support teams need simple operational behavior

Use trigger-based starts when:

- the business event truly needs a fast reaction
- the volume is controlled
- the downstream job is safe to rerun or ignore duplicate requests

Use a queue table when:

- the source event volume is uneven
- visibility into pending work is important
- direct trigger-to-job execution creates too much operational risk

## Final notes

- keep SQL Agent jobs thin and let stored procedures do the real work
- time-based schedules are typically easier to operate
- use trigger-driven starts sparingly and document them well
- if event-driven behavior grows more complex, move toward a queue-based orchestration pattern
