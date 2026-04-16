---
layout: page
title: Scribbles
permalink: /scribbles/
icon: pencil
type: page
---

<div class="scribbles-lock" data-scribbles-lock>
  <p class="scribbles-lock-eyebrow">Private Notes</p>
  <p class="scribbles-lock-copy">Which year did we meet in the Afterlife?</p>
  <form class="scribbles-lock-form" data-scribbles-form>
    <label class="scribbles-lock-label" for="scribblesPasscode">Passcode</label>
    <input id="scribblesPasscode" class="scribbles-lock-input" type="password" inputmode="numeric" autocomplete="off" />
    <button class="scribbles-lock-button" type="submit">Unlock</button>
  </form>
  <p class="scribbles-lock-error" data-scribbles-error hidden>Incorrect passcode.</p>
</div>

<div class="scribbles-content" data-scribbles-content hidden>
  <p class="scribbles-lock-eyebrow">Scribbles</p>
  <p>This page is for personal notes, drafts, and half-formed ideas that are not ready to be published as full articles yet.</p>

  <ul>
    {% assign scribbles_sorted = site.scribbles | sort: "title" %}
    {% for note in scribbles_sorted %}
    <li><a href="{{ note.url | prepend: site.baseurl }}">{{ note.title }}</a>{% if note.summary %}: {{ note.summary }}{% endif %}</li>
    {% endfor %}
  </ul>
</div>
