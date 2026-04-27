---
layout: page
title: Databricks Playbooks
permalink: /databricks-playbooks/
icon: magic
type: hidden
topic_filter: Databricks
topic_label: Databricks Playbooks
---

Practical Databricks notes covering notebooks, jobs, Python services, assistants, environments, and lakehouse delivery patterns.

## Articles

{% assign sorted_posts = site.posts | sort: "title" %}
{% for post in sorted_posts %}
{% if post.tags contains "Databricks" or post.categories contains "Databricks" %}
- [{{ post.title }}]({{ post.url | prepend: site.baseurl }}){% if post.summary %}: {{ post.summary }}{% endif %}
{% endif %}
{% endfor %}

## What belongs here

- notebook and asset organization that scales beyond one analyst
- jobs, services, and automation patterns that connect to the lakehouse
- assistant, ML, and Python workflows that help teams ship faster
