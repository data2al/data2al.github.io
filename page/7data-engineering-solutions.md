---
layout: page
title: Data Engineering Solutions
permalink: /data-engineering-solutions/
icon: sitemap
type: hidden
---

Cross-platform patterns for pipelines, warehousing, data movement, and operating models across Snowflake, Databricks, and supporting tools.

## Articles

{% assign sorted_posts = site.posts | sort: "title" %}
{% for post in sorted_posts %}
{% if post.categories contains "Data Engineering" %}
- [{{ post.title }}]({{ post.url | prepend: site.baseurl }}){% if post.summary %}: {{ post.summary }}{% endif %}
{% endif %}
{% endfor %}

## What belongs here

- dbt model structure for staging, intermediate, and marts layers
- warehouse orchestration and refresh strategy
- incremental loading, deduplication, and data quality checks
- performance tuning, cost control, and platform operating patterns
