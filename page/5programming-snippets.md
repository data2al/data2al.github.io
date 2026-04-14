---
layout: page
title: Programming Articles
permalink: /programming-snippets/
icon: code
type: hidden
---

Reusable Python and utility examples for common workflow tasks.

## Articles

{% assign sorted_posts = site.posts | sort: "title" %}
{% assign has_programming_posts = false %}
{% for post in sorted_posts %}
{% if post.categories contains "Programming" %}
{% assign has_programming_posts = true %}
- [{{ post.title }}]({{ post.url | prepend: site.baseurl }}){% if post.summary %}: {{ post.summary }}{% endif %}
{% endif %}
{% endfor %}
{% unless has_programming_posts %}
- No programming articles yet. This section is ready for future notes.
{% endunless %}

## What belongs here

- Python helpers for data workflows
- reusable utility patterns for scripts and jobs
- examples that solve common implementation problems cleanly
