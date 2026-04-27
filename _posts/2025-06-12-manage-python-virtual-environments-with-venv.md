---
layout: post
title: "Manage Python Environments for Snowpark and Databricks Projects"
categories: Databricks
tags: Python Snowpark Databricks venv Packaging Local-Development
author: Alan
summary: "A practical workflow for keeping Snowpark and Databricks local Python environments isolated, repeatable, and easy to rebuild."
level: Beginner
---

* content
{:toc}

When one project uses the Snowflake connector, another uses Snowpark, and a third depends on Databricks SDK packages, dependency drift becomes easy to create and annoying to debug. Python virtual environments are the simplest way to keep those stacks isolated.

## Create a virtual environment

```bash
python -m venv .venv
```

## Activate the environment

### PowerShell

```powershell
.venv\Scripts\Activate.ps1
```

### Command Prompt

```cmd
.venv\Scripts\activate.bat
```

### macOS or Linux

```bash
source .venv/bin/activate
```

## Install the packages you need

```bash
python -m pip install snowflake-connector-python snowflake-snowpark-python databricks-sdk pandas
```

Using `python -m pip` helps ensure the packages install into the active environment.

## Save dependencies

```bash
python -m pip freeze > requirements.txt
```

This makes it easier to recreate the same setup in CI or on another machine.

## Rebuild when needed

```powershell
Remove-Item -Recurse -Force .venv
python -m venv .venv
python -m pip install -r requirements.txt
```

## Notes

- keep `.venv` out of version control
- store dependency definitions in `requirements.txt` or another lock file
- activate the environment before running Snowpark jobs, Databricks scripts, or tests
- rebuild the environment when package state becomes difficult to debug
