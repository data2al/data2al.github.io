---
layout: post
title: "Move Large Datasets With Resumable and Verified Transfers"
categories: ["Data Engineering"]
tags: Data-Engineering Data-Transfer Python rsync rclone Checksums Reliability Networking
author: Alan
summary: "A practical guide to moving large datasets safely, estimating transfer time, and choosing between transfer tools, warehouse-native loading patterns, and Python orchestration."
level: Intermediate
permalink: /data-engineering-solutions/move-large-datasets-with-resumable-verified-transfers/
---

* content
{:toc}

Moving a large dataset is not just a copy problem. It is also a throughput problem, a failure-recovery problem, and a verification problem.

If you are moving 1 TB from one system to another, the key questions are:

- how fast is the real bottleneck
- how do you resume after interruption
- how do you verify that the destination is complete and correct
- how do you avoid restarting from zero after a partial failure

This article focuses on two common scenarios:

- file-to-file or server-to-server transfer
- database-to-data-warehouse migration

It also addresses a common assumption: writing a Python script is not automatically better than using an established transfer tool or ingestion pattern.

## Start with transfer-time reality

The lower bound is set by bandwidth.

For planning purposes:

```text
transfer time = data size / effective throughput
```

For 1 TB, the ideal transfer times look roughly like this:

| Link speed | Theoretical minimum for 1 TB | Real-world expectation |
| --- | --- | --- |
| 100 Mbps | about 22 hours | 24 to 30+ hours |
| 1 Gbps | about 2.2 hours | 3 to 5 hours |
| 10 Gbps | about 13 minutes | 20 to 45 minutes |

Real-world times are slower because of:

- TCP overhead
- encryption overhead
- storage read speed on the source
- storage write speed on the destination
- latency and packet loss
- file-count overhead when many small files are involved
- contention from other workloads

That means a 1 Gbps network does not guarantee a 2.2-hour transfer. If either disk tops out below network speed, storage becomes the real bottleneck.

## Core design principles

If the goal is to avoid losing progress, the transfer design should include:

- chunked transfer so work is broken into restartable units
- persistent progress tracking so completed units are recorded
- checksum validation so corruption is detected
- retry with backoff so transient network failures do not kill the job
- idempotent writes so reruns do not duplicate or corrupt data
- final reconciliation so source and destination are compared before cutover

These principles matter more than the programming language.

## Scenario 1: file transfer between servers

This is the scenario where tools such as `rsync` and `rclone` are most relevant.

## For one large file, use ranged or block-based transfer

If the 1 TB dataset is a single archive or export file, the safest pattern is to transfer it in blocks or with a tool that supports resuming from byte offsets.

Good patterns include:

- resumable copy with partial-file support
- multipart upload or multipart copy when object storage is involved
- block-level manifests that record which parts finished successfully

This avoids the worst-case outcome where a transfer nears completion, disconnects, and restarts from zero.

## For many files, metadata overhead matters

A million 1 MB files behaves very differently from one 1 TB file. The total size may be the same, but many small files create additional overhead from:

- directory traversal
- open and close operations
- permission checks
- per-file retries
- checksum calls on every object

This is why large migrations are often faster when files are first packed into larger transfer units, or when the transfer tool can parallelize while maintaining a durable manifest.

## Preferred tools for file transfer

For file-based server-to-server moves, purpose-built tools are often the right first choice:

- `rsync` for filesystem-based transfers with resume-like behavior and delta copy
- `rclone` for cloud and object-storage-oriented transfers
- storage-native tools such as `azcopy`, `aws s3 sync`, or `gsutil` when the platforms match

`rsync` is a long-standing file synchronization tool commonly used between Linux and Unix-like systems. It is designed to copy and reconcile files efficiently, and it can avoid retransferring data that already exists at the destination. That makes it useful for server-to-server filesystem migrations, repeat syncs, and recovery after interruption.

`rclone` is a command-line tool built for moving and synchronizing data across cloud storage systems and object stores. It supports providers such as S3, Azure Blob Storage, and Google Cloud Storage, and it is often a better fit when the transfer crosses local filesystems and cloud platforms rather than staying between two traditional servers.

These tools are not inherently problematic because they are abstracted. Mature tools already implement the hard parts:

- retries
- checkpointing or partial progress
- concurrency control
- bandwidth tuning
- checksum or integrity checks
- logging

For that reason, the claim that Python scripts are always more efficient is not correct.

## When Python is not the best answer

If the problem is simply moving data from A to B reliably, writing a transfer engine from scratch in Python is usually slower to build, riskier to test, and easier to get wrong.

A custom Python script is usually a worse choice when:

- a mature transfer tool already supports the source and destination
- the main need is high-throughput copy with resume
- the transfer must be operational quickly
- the team does not want to maintain custom retry and recovery logic forever

In those cases, using `rsync`, `rclone`, or a platform-native bulk transfer tool is usually more efficient overall.

## When Python adds value

Python becomes useful when the transfer process needs orchestration beyond copying bytes.

Examples:

- building a manifest before transfer
- filtering files based on metadata or naming rules
- orchestrating batches and priority tiers
- recording progress in a database
- performing custom checksum comparison
- sending alerts and operational metrics
- coordinating extract, compress, transfer, validate, and promote steps

In practice, Python is often strongest as the control plane rather than the raw data plane.

That distinction matters:

- let a proven tool move the bytes
- let Python orchestrate, validate, and report

That approach is usually stronger than replacing the transfer tool entirely with Python.

## A practical 1 TB file-transfer design

Suppose you need to move 1 TB of files from Server A to Server B and interruptions are likely enough to plan for.

A resilient design would look like this:

1. inventory the source files and sizes
2. generate a manifest with file path, size, and checksum
3. copy in parallel using a resumable transfer tool
4. write transfer logs and progress state after each completed file or chunk
5. retry transient failures automatically
6. validate destination size and checksum against the manifest
7. promote the destination only after reconciliation passes

If the dataset is actively changing, add one more rule:

- freeze writes or run a final delta sync before cutover

Otherwise, the destination may be consistent with an earlier point in time rather than the final source state.

## What a Python-controlled transfer should include

If you need a Python-controlled transfer, the script should not be a simple `shutil.copy` loop. It should include:

- a durable manifest file or database table
- per-file or per-chunk status such as `pending`, `in_progress`, `complete`, `failed`
- checksum calculation such as SHA-256 or a fast hash plus final strong verification
- retry logic with capped exponential backoff
- structured logs
- a configurable concurrency limit
- temporary destination names followed by atomic rename on success
- a restart mode that skips already validated units

At that point, the script is no longer a lightweight utility. It is a transfer system.

That is exactly why mature tools are often the better default.

## Scenario 2: moving data from a database into a data warehouse

This is a different problem from copying files. If the source is PostgreSQL, MySQL, SQL Server, Oracle, or another operational database, the goal is usually not to copy database files directly. The goal is to extract table data safely and load it into an analytical system in a form the warehouse can ingest efficiently.

For this scenario, the main design questions become:

- is this a one-time migration or an ongoing pipeline
- can the source system tolerate long-running reads
- do you need a full historical backfill, change data capture, or both
- should the data land in object storage first or be streamed directly
- how do you preserve consistency while the source database is still changing

## Do not treat database migration like raw file copy

Copying database files at the filesystem level is usually the wrong method unless you are doing a database-native backup and restore into the same engine family.

For analytical migration, the safer pattern is usually:

1. extract from the source database in batches
2. land the data in files or staging tables
3. load into the warehouse using the warehouse's bulk ingestion path
4. validate counts, checksums, and key business totals
5. run a final delta sync or CDC catch-up before cutover

This pattern is more portable and easier to validate.

## For large migrations, unload and bulk load

For a 1 TB database migration into a warehouse, the common high-throughput pattern is:

- read source tables in chunks
- write those chunks to durable staging storage, often object storage
- store them in warehouse-friendly formats such as CSV or Parquet
- use the warehouse's native bulk loader to ingest in parallel

Examples:

- PostgreSQL to Snowflake via staged files and `COPY INTO`
- SQL Server to BigQuery via extract files and load jobs
- MySQL to Redshift via S3 staging and `COPY`

This is usually more efficient than row-by-row inserts from Python because warehouses are optimized for bulk ingestion rather than millions of small client-driven insert operations.

## Expect the bottleneck to shift

In a database-to-warehouse migration, the bottleneck is often not just the network. It may be:

- source query speed
- source index design
- lock contention or replication lag risk
- export serialization speed
- object storage throughput
- warehouse load concurrency

This is why a 1 TB migration can take much longer than the raw network math suggests. The source database may not be able to sustain a full-speed export without affecting production traffic.

## Use batching and watermarks to avoid losing progress

For database extraction, resumability usually comes from logical checkpoints rather than byte offsets.

Common patterns include:

- extract by primary key ranges
- extract by date windows
- extract by monotonically increasing IDs
- track the last successful high-water mark
- record batch status in a control table

For example, instead of one giant query for a billion-row table, split the work into chunks such as:

- rows with `id` 1 to 5,000,000
- rows with `id` 5,000,001 to 10,000,000
- and so on

If one batch fails, rerun only that batch instead of restarting the entire table from zero.

## Change data capture is often the right mechanism

If the source database stays online while the migration is happening, a full extract alone is not enough. New inserts and updates will continue to arrive.

That usually leads to a two-phase design:

1. run an initial full backfill
2. capture ongoing changes until the warehouse catches up

Mechanisms may include:

- database CDC tooling
- transaction log or binlog readers
- platform replication services
- timestamp-based incremental extraction when CDC is unavailable

CDC is often the cleanest path because it avoids repeated full-table scans after the initial load.

## Where Python helps in database migration

Python can be useful here, but again it is usually strongest as the orchestration layer rather than the fastest transport layer.

Good uses for Python include:

- generating extract ranges
- coordinating parallel workers
- writing control-table state
- validating row counts and checksums
- triggering warehouse load commands
- reconciling failures and rerunning only incomplete batches

Python is less attractive when used for:

- row-by-row extraction and row-by-row insert at massive scale
- building a custom CDC engine from scratch
- replacing warehouse-native bulk loaders with application loops

So if the question is whether to write a Python script to move 1 TB from a database into a warehouse, the best answer is usually:

- use Python to orchestrate
- use database-native extraction or connector tooling to read
- use staged files and warehouse-native bulk loading to write

## A practical 1 TB database-to-warehouse design

Suppose you need to move 1 TB from an operational database into a cloud warehouse with minimal restart risk.

A resilient design would look like this:

1. profile the largest tables and estimate row counts and extract cost
2. choose extraction chunks by key range or time window
3. unload each chunk to durable staging storage
4. load each chunk into a staging schema in the warehouse
5. record batch status, row counts, and validation results
6. rerun failed chunks only
7. apply CDC or a final incremental sync
8. promote validated tables into the final analytical model

That gives you restartability at the table and batch level instead of relying on one enormous migration job.

## Compression is situational

People often assume compression always helps. It does not.

Compression helps when:

- the data is text-heavy or highly compressible
- CPU is available
- the network is the main bottleneck

Compression may hurt when:

- the data is already compressed
- CPU is the bottleneck
- wall-clock simplicity matters more than reducing bytes

Formats such as Parquet, ORC, ZIP, JPEG, and many database backups may already be compressed enough that recompressing adds little value.

## Make integrity and security explicit

For production transfers, do not leave integrity and security implicit.

Include:

- encryption in transit
- checksums before and after transfer
- a manifest or audit log
- clear failure reporting

A transfer that finishes quickly but cannot prove correctness is not complete.

## Recommended approach

For a 1 TB move, these are usually the strongest patterns:

- `rsync` for filesystem-to-filesystem transfer with resumable behavior and post-copy validation
- `rclone` or a cloud-native bulk transfer tool for object storage or mixed environments
- staged extraction plus warehouse-native bulk loading for database-to-warehouse migration
- Python on top for orchestration, manifests, reporting, and cutover logic

I would not start by building a fully custom Python byte-transfer engine or a row-by-row migration loop unless the environment had unusual constraints that existing tools and native loaders could not satisfy.

## Final takeaway

The best large-data transfer design is not "use Python" or "use a black-box app." It is:

- use mature transfer mechanisms for the actual byte movement
- use bulk warehouse ingestion patterns when the destination is analytical
- make the process resumable and idempotent
- verify the result with checksums and reconciliation
- add Python only where custom workflow logic creates real value

For a 1 TB move, efficiency comes from restartability, batching, parallelism, and verification far more than from hand-writing the transport layer yourself.
