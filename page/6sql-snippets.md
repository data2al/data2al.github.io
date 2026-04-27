---
layout: page
title: SQL Articles
permalink: /sql-snippets/
icon: database
type: hidden
---

Reference queries for common warehouse and analytics engineering tasks.

## Articles

{% assign sorted_posts = site.posts | sort: "title" %}
{% assign has_sql_posts = false %}
{% for post in sorted_posts %}
{% if post.categories contains "SQL" %}
{% assign has_sql_posts = true %}
- [{{ post.title }}]({{ post.url | prepend: site.baseurl }}){% if post.summary %}: {{ post.summary }}{% endif %}
{% endif %}
{% endfor %}
{% unless has_sql_posts %}
- No SQL-focused articles yet. This section is ready for future notes.
{% endunless %}

## What belongs here

- warehouse query patterns
- data quality and validation checks
- transformation examples for modeling and analytics engineering
- SQL Server operations that belong with the SQL body of work
