---
layout: default
title: Focus Timer
permalink: /focus/
icon: clock-o
type: page
---

<main class="focus-page" data-focus-app>
  <section class="focus-shell">
    <section class="focus-workspace" aria-label="Focus timer">
      <div class="focus-timer-panel">
        <div class="focus-mode-tabs" role="tablist" aria-label="Timer mode">
          <button class="focus-mode is-active" type="button" data-mode="pomodoro">Pomodoro</button>
          <button class="focus-mode" type="button" data-mode="short">Short Break</button>
          <button class="focus-mode" type="button" data-mode="long">Long Break</button>
        </div>

        <div class="focus-time" data-timer-display>25:00</div>

        <div class="focus-controls" aria-label="Timer controls">
          <button class="focus-control-button focus-control-primary" type="button" data-timer-toggle>
            <i class="fa fa-play" aria-hidden="true"></i>
            <span>Start</span>
          </button>
          <button class="focus-icon-button" type="button" data-music-toggle aria-label="Unmute music" title="Unmute music">
            <i class="fa fa-volume-off" aria-hidden="true"></i>
          </button>
          <button class="focus-icon-button" type="button" data-timer-reset aria-label="Reset timer" title="Reset timer">
            <i class="fa fa-refresh" aria-hidden="true"></i>
          </button>
        </div>

        <div class="focus-session-row" aria-live="polite">
          <span data-session-count>0</span>
          <span>focus rounds finished today</span>
        </div>

        <div class="focus-music-panel">
          <a href="https://www.youtube.com/watch?v=jfKfPfyJRdk" target="_blank" rel="noopener" data-music-link>lofi hip hop radio</a>
          <label class="focus-music-select">
            <span>Music</span>
            <select data-music-source>
              <option value="jfKfPfyJRdk" selected>lofi hip hop radio</option>
              <option value="LvkuwIDPtLc">Pulse: FFXIV DJ Remix</option>
              <option value="2hCLfuwGB-4">Rainy Night NieR Piano</option>
              <option value="vYG-E-kfHoI">Persona 4 MEGAMIX A-side</option>
              <option value="VuF0Kj1vX98">Persona 3 Reload MEGAMIX</option>
              <option value="Ez2ee0TEYP8">Persona 5 MEGAMIX A-side</option>
              <option value="3frlf4W0KOc">Zelda Jazz Cafe Music</option>
            </select>
          </label>
          <label class="focus-volume-control">
            <span>Volume</span>
            <input type="range" min="0" max="100" step="1" value="35" data-music-volume>
          </label>
          <iframe
            data-youtube-player
            width="300"
            height="90"
            src="https://www.youtube.com/embed/jfKfPfyJRdk?enablejsapi=1&amp;playsinline=1&amp;controls=1"
            title="Lofi Girl live radio"
            allow="autoplay; encrypted-media"
            loading="lazy"></iframe>
        </div>
      </div>
    </section>
  </section>
</main>
