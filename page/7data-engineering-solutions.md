---
layout: page
title: Data Engineering Solutions
permalink: /data-engineering-solutions/
icon: sitemap
type: hidden
---

Concept notes and implementation patterns for pipelines, warehousing, and modeling.

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
- performance tuning for warehouse transformations
