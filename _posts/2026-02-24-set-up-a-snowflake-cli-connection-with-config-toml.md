---
layout: post
title: "Set Up a Snowflake CLI Connection With config.toml"
categories: Snowflake
tags: Snowflake Snowflake-CLI config.toml Connectivity DevOps CI-CD
author: Alan
summary: "A practical guide to defining a Snowflake CLI connection in config.toml, setting a default connection, and validating access locally or in CI/CD pipelines."
level: Beginner
permalink: /snowflake-playbooks/set-up-a-snowflake-cli-connection-with-config-toml/
---

* content
{:toc}

The Snowflake CLI uses a `config.toml` file to define reusable connections to Snowflake accounts. This is a practical way to standardize local development, avoid repetitive command-line flags, and keep connection names consistent across projects.

For data engineering work, a named connection is usually the cleanest starting point. It gives you one place to define account-level settings such as the account identifier, user, warehouse, role, database, and schema, while allowing individual commands to stay short and readable.

## Understand where `config.toml` lives

Current Snowflake CLI documentation uses OS-specific configuration paths:

- Linux: `~/.config/snowflake/config.toml`
- Windows: `%USERPROFILE%\AppData\Local\snowflake\config.toml`
- macOS: `~/Library/Application Support/snowflake/config.toml`

Older examples sometimes reference `~/.snowflake/config.toml`. If you are following a recent Snowflake CLI installation, use the current platform-specific path documented by Snowflake.

## Define a default connection

The `config.toml` file supports a `default_connection_name` at the top of the file, followed by one or more named connection blocks under `[connections.<name>]`.

Example:

```toml
default_connection_name = "advanced_data_engineering_snowflake"

[connections.advanced_data_engineering_snowflake]
account = "your-organization-your-account"
user = "your.username"
warehouse = "COMPUTE_WH"
role = "ACCOUNTADMIN"
database = "ANALYTICS"
schema = "PUBLIC"
```

This structure does two things:

- it assigns a readable name to the connection
- it lets Snowflake CLI use that connection by default unless another one is specified

## Add credentials carefully

It is possible to place `password = "..."` directly inside the connection block, but Snowflake documentation recommends using environment variables for passwords instead of storing them in `config.toml`.

A stronger pattern is to keep the connection metadata in the file and provide the password through an environment variable.

Example environment variable for a named connection:

```powershell
$env:SNOWFLAKE_CONNECTIONS_ADVANCED_DATA_ENGINEERING_SNOWFLAKE_PASSWORD="your-password"
```

Generic environment variables also work:

```powershell
$env:SNOWFLAKE_PASSWORD="your-password"
```

For teams and shared machines, this separation is a better operational pattern than committing or copying passwords into local config files.

## A complete local example

If you want a clear starter configuration, use a structure like this:

```toml
default_connection_name = "advanced_data_engineering_snowflake"

[connections.advanced_data_engineering_snowflake]
account = "your-organization-your-account"
user = "your.username"
warehouse = "COMPUTE_WH"
role = "ACCOUNTADMIN"
database = "ANALYTICS"
schema = "PUBLIC"
```

Then set the password in your shell session:

```powershell
$env:SNOWFLAKE_CONNECTIONS_ADVANCED_DATA_ENGINEERING_SNOWFLAKE_PASSWORD="your-password"
```

At that point, the CLI can use the named connection without repeating credentials in each command.

## Test the connection

After the connection is defined, validate it immediately.

The direct connection test command is:

```powershell
snow connection test -c advanced_data_engineering_snowflake
```

If you set `default_connection_name` correctly, you can also run:

```powershell
snow connection test
```

This confirms that the CLI can authenticate and reach the Snowflake account using the selected configuration.

## Run a simple SQL check after the connection test

A connection test is useful, but in data engineering workflows it is often better to follow it with a lightweight SQL command that verifies the warehouse, role, and session context behave as expected.

For example:

```powershell
snow sql -c advanced_data_engineering_snowflake -q "select current_account(), current_user(), current_role(), current_warehouse();"
```

This helps confirm not only that authentication works, but also that the connection is pointing at the expected operational context.

## Use named connections to separate environments

A common production pattern is to define one connection per environment instead of reusing one account definition for everything.

For example:

```toml
default_connection_name = "snowflake_dev"

[connections.snowflake_dev]
account = "org-dev_account"
user = "your.username"
warehouse = "DEV_WH"
role = "DEVELOPER"
database = "DEV_ANALYTICS"
schema = "PUBLIC"

[connections.snowflake_prod]
account = "org-prod_account"
user = "svc_data_pipeline"
warehouse = "PROD_WH"
role = "ETL_RUNNER"
database = "PROD_ANALYTICS"
schema = "PUBLIC"
```

Then you can switch behavior explicitly:

```powershell
snow connection test -c snowflake_dev
snow connection test -c snowflake_prod
```

This is clearer and safer than editing the same connection block repeatedly.

## CI/CD considerations

In CI/CD pipelines, Snowflake documentation notes that you may prefer dedicated configuration files or temporary connections rather than relying on one shared local default file.

Two practical patterns are common.

### Pattern 1: use a pipeline-specific config file

Store non-secret connection metadata in a dedicated config file and inject secrets through environment variables at runtime.

Example validation step:

```bash
snow --config-file ci/config.toml connection test -c deploy_connection
snow --config-file ci/config.toml sql -c deploy_connection -q "select current_version();"
```

This keeps the pipeline explicit and makes deployments easier to audit.

### Pattern 2: use a temporary connection

When a pipeline should not rely on a persisted config file, you can pass connection details on the command line and use environment variables for secrets.

Example:

```bash
export SNOWFLAKE_PASSWORD="$SNOWFLAKE_PASSWORD"

snow connection test \
  --temporary-connection \
  --account "$SNOWFLAKE_ACCOUNT" \
  --user "$SNOWFLAKE_USER" \
  --warehouse "$SNOWFLAKE_WAREHOUSE" \
  --role "$SNOWFLAKE_ROLE" \
  --database "$SNOWFLAKE_DATABASE" \
  --schema "$SNOWFLAKE_SCHEMA"
```

This approach is useful when the pipeline environment is ephemeral and connection state should not be stored on disk.

## Operational recommendations

- use named connections that reflect environment purpose, such as `snowflake_dev` or `snowflake_prod`
- keep secrets in environment variables or secret stores rather than hardcoding them in `config.toml`
- test the connection immediately after setup
- run a simple SQL validation query after the connection test
- separate local developer connections from CI/CD deployment connections

## Summary

The `config.toml` file is the standard way to define reusable Snowflake CLI connections. A good setup usually includes:

- one clearly named connection per environment
- a `default_connection_name` for local convenience
- passwords supplied through environment variables
- a `snow connection test` step to validate access
- an additional SQL query to confirm the expected execution context

That combination gives you a connection setup that is easier to operate, safer to maintain, and more suitable for both local engineering work and automated deployment pipelines.
