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
{% assign has_databricks_posts = false %}
{% for post in sorted_posts %}
{% if post.categories contains "Databricks" %}
{% assign has_databricks_posts = true %}
- [{{ post.title }}]({{ post.url | prepend: site.baseurl }}){% if post.summary %}: {{ post.summary }}{% endif %}
{% endif %}
{% endfor %}
{% unless has_databricks_posts %}
- No Databricks playbooks yet. This section is ready for future notes.
{% endunless %}

## What belongs here

- notebook and asset organization that scales beyond one analyst
- jobs, services, and automation patterns that connect to the lakehouse
- assistant, ML, and Python workflows that help teams ship faster
