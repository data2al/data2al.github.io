---
layout: page
title: AI and Automation Notes
permalink: /ai-and-automation/
icon: magic
type: hidden
---

Notes on agent systems, workflow automation, and practical AI usage in engineering work.

## Articles

{% assign sorted_posts = site.posts | sort: "title" %}
{% for post in sorted_posts %}
{% if post.categories contains "AI" %}
- [{{ post.title }}]({{ post.url | prepend: site.baseurl }}){% if post.summary %}: {{ post.summary }}{% endif %}
{% endif %}
{% endfor %}

## What belongs here

- agent workflow design
- automation patterns for repetitive tasks
- practical notes on tool behavior and implementation tradeoffs
