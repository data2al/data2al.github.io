---
layout: post
title: "Manage Python Virtual Environments With venv"
categories: Programming
tags: Python Virtual-Environment venv Packaging
author: Alan
summary: "A reference workflow for creating, activating, updating, and removing Python virtual environments with venv."
level: Beginner
---

* content
{:toc}

Python virtual environments isolate project dependencies so one project does not overwrite or conflict with another. The built-in `venv` module is the standard way to manage that isolation in many local development workflows.

## Create a virtual environment

```bash
python -m venv .venv
```

This creates a `.venv` directory containing:

- a Python interpreter for the environment
- installed packages for that environment
- activation scripts for different shells

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

After activation, `python` and `pip` point to the environment instead of the system interpreter.

## Install packages into the environment

```bash
python -m pip install snowflake-connector-python pandas
```

Using `python -m pip` helps ensure that `pip` installs into the currently active interpreter.

## Save dependencies to a requirements file

```bash
python -m pip freeze > requirements.txt
```

This captures the installed package versions so the environment can be recreated later.

## Recreate the environment from requirements

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

On Windows, the activation command should match the shell in use.

## Deactivate the environment

```bash
deactivate
```

This returns the shell to the default system Python.

## Remove and rebuild the environment

If an environment becomes inconsistent, it can be removed and recreated.

```bash
rm -rf .venv
python -m venv .venv
python -m pip install -r requirements.txt
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .venv
python -m venv .venv
python -m pip install -r requirements.txt
```

## Notes

- keep `.venv` out of version control
- store dependency definitions in `requirements.txt` or another lock file
- activate the environment before running scripts, tests, or package installs
- recreate the environment when package state becomes difficult to debug
