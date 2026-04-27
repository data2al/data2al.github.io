---
layout: post
title: "Use Docker for Local Databricks Development"
categories: Databricks
tags: Docker Databricks Development DevOps Local-Development
author: Alan
summary: "A reference pattern for using Docker to standardize local Databricks tooling, dependencies, and support services."
level: Beginner
---

* content
{:toc}

Docker is useful for local Databricks support work when you want reproducible tooling without depending on every laptop being configured the same way.

## Common use cases

- running Python loaders or SDK clients in a pinned environment
- testing file movement and orchestration code
- starting support services such as Redis or local APIs
- isolating dependency-heavy projects from the host machine

## Start a development container

```bash
docker run -d \
  --name data-platform-dev \
  -v "$(pwd):/workspace" \
  -w /workspace \
  python:3.12-slim \
  sleep infinity
```

## Check running containers

```bash
docker ps
```

## Open a shell inside the container

```bash
docker exec -it data-platform-dev /bin/sh
```

## Mount local files into the container

```bash
docker run -d \
  --name app-dev \
  -v "$(pwd):/app" \
  python:3.12-slim \
  sleep infinity
```

With this setup:

- files are edited locally
- the container sees the same files under `/app`
- local tooling stays reproducible

## Put support containers on the same network

```bash
docker network create app-net
docker run -d --name redis-cache --network app-net redis:7
docker run -d --name job-runner --network app-net python:3.12-slim sleep infinity
```

This helps when a Databricks helper service, notebook utility, or test harness needs nearby support services.

## Notes

- mounted directories are usually easier than editing files inside a container
- `docker exec` is useful for inspection and debugging
- user-defined bridge networks provide container-to-container DNS by name
- keep durable changes on the host or rebuild the image
- use `docker compose` when several support services need to run together
