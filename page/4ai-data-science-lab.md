---
layout: page
title: AI/Data Science Lab
permalink: /ai-data-science-lab/
icon: flask
type: hidden
topic_filter: AI/Data Science Lab
topic_label: AI/Data Science Lab
---

Runnable Snowflake AI and data science labs with sample data, step-by-step scripts, model workflows, evaluation checks, and cleanup sections.

## Articles

<ul>
{% assign sorted_posts = site.posts | sort: "title" %}
{% assign has_ai_data_science_lab = false %}
{% for post in sorted_posts %}
{% if post.categories contains "AI/Data Science Lab" %}
{% assign has_ai_data_science_lab = true %}
  <li><a href="{{ post.url | prepend: site.baseurl }}">{{ post.title }}</a>{% if post.summary %}: {{ post.summary }}{% endif %}</li>
{% endif %}
{% endfor %}
</ul>
{% unless has_ai_data_science_lab %}
- No AI/Data Science labs yet. This section is ready for future Snowflake AI, ML, and Gen AI walkthroughs.
{% endunless %}

## What belongs here

- runnable Snowflake data science and Gen AI labs
- sample data that can be created directly from SQL worksheets or Snowflake Notebooks
- model training, evaluation, inference, registry, and lifecycle examples
- Cortex AI, LLM, embedding, vector search, and RAG workflows
- secure, governed AI patterns that are practical for enterprise Snowflake environments
