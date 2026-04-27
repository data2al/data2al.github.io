---
layout: page
title: Data Engineering Lab
permalink: /data-engineering-lab/
icon: wrench
type: hidden
topic_filter: Data Engineering Lab
topic_label: Data Engineering Lab
---

Runnable Snowflake data engineering labs with sample data, step-by-step scripts, and cleanup sections.

## Articles

<ul>
{% assign sorted_posts = site.posts | sort: "title" %}
{% assign has_data_engineering_lab = false %}
{% for post in sorted_posts %}
{% if post.categories contains "Data Engineering Lab" %}
{% assign has_data_engineering_lab = true %}
  <li><a href="{{ post.url | prepend: site.baseurl }}">{{ post.title }}</a>{% if post.summary %}: {{ post.summary }}{% endif %}</li>
{% endif %}
{% endfor %}
</ul>
{% unless has_data_engineering_lab %}
- No data engineering labs yet. This section is ready for future notes.
{% endunless %}

## What belongs here

- runnable Snowflake certification labs
- ingestion, transformation, task, dynamic table, and monitoring workflows
- sample data that can be created directly from SQL worksheets
