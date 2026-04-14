---
layout: post
title: "Use Docker to Run Services and Edit Files in Containers"
categories: Programming
tags: Docker Containers Development DevOps
author: Alan
summary: "A reference pattern for starting Docker containers, inspecting them, and editing files that live inside a running container."
level: Beginner
---

* content
{:toc}

Docker is commonly used to package applications and services into portable containers. In development workflows, the most common tasks are:

- starting a container
- listing running containers
- opening a shell inside a container
- copying files into or out of a container
- editing application files that are mounted into the container
- connecting multiple containers on the same network

## Start a container

This example starts an Nginx container in detached mode and maps local port `8080` to port `80` inside the container.

```bash
docker run -d --name web-demo -p 8080:80 nginx:latest
```

## Check which containers are running

```bash
docker ps
```

This shows the container id, name, image, status, and exposed ports.

## Open a shell inside the container

If the container includes a shell, `docker exec` can be used to inspect files directly.

```bash
docker exec -it web-demo /bin/sh
```

For images that include Bash:

```bash
docker exec -it web-demo /bin/bash
```

## Edit files that live in a container

There are two common cases.

### Case 1: files are mounted from the host

This is the most common development pattern. The container reads files from a local directory mounted into the container filesystem.

```bash
docker run -d \
  --name app-dev \
  -p 5000:5000 \
  -v "$(pwd):/app" \
  python:3.12-slim \
  sleep infinity
```

With this setup:

- files are edited locally in the project directory
- the container sees the same files under `/app`
- no direct editing inside the container is required

This pattern is typically easier to maintain because the local editor remains the source of truth.

## Confirm the mounted files inside the container

```bash
docker exec -it app-dev ls /app
```

## Case 2: files exist only inside the container

If the files only exist inside the container, they can be copied out, edited locally, and copied back in.

Copy a file from the container to the host:

```bash
docker cp app-dev:/app/config.py ./config.py
```

Copy the edited file back into the container:

```bash
docker cp ./config.py app-dev:/app/config.py
```

## Put two containers on the same bridge network

Docker containers can talk to each other more predictably when they are attached to a user-defined bridge network. On that network, containers can resolve each other by container name.

## Create a bridge network

```bash
docker network create app-net
```

## Start two containers on that network

This example starts an API container and a Redis container on the same bridge network.

```bash
docker run -d --name redis-cache --network app-net redis:7
docker run -d --name api-service --network app-net python:3.12-slim sleep infinity
```

## Verify that both containers are attached to the same network

```bash
docker network inspect app-net
```

The output lists the connected containers and their assigned network addresses.

## Communicate between containers by name

Once both containers are on the same user-defined bridge network, one container can refer to the other by its container name.

For example, a Python application inside `api-service` can use `redis-cache` as the Redis host:

```python
import redis

client = redis.Redis(host="redis-cache", port=6379, decode_responses=True)
client.set("status", "ok")
print(client.get("status"))
```

To test connectivity from inside the application container:

```bash
docker exec -it api-service /bin/sh
```

Then from inside the container shell:

```bash
python -c "import socket; print(socket.gethostbyname('redis-cache'))"
```

If DNS resolution works, Docker returns the IP address for the `redis-cache` container on `app-net`.

## Connect an existing container to a bridge network

If a container is already running, it can be attached to the network without recreating it.

```bash
docker network connect app-net app-dev
```

This is useful when a development container needs access to another service that is already running on the bridge network.

## View logs while the container is running

```bash
docker logs -f app-dev
```

This is useful after editing configuration or application files because it shows whether the service restarted correctly or raised an error.

## Stop and remove the container

```bash
docker stop app-dev
docker rm app-dev
```

## Notes

- mounted directories are usually more convenient than editing files directly inside a container
- `docker exec` is useful for inspection and debugging, but container filesystems may be temporary
- user-defined bridge networks provide container-to-container DNS by name
- if changes need to survive container replacement, store them on the host or rebuild the image
- use `docker compose` when multiple services need to run together
