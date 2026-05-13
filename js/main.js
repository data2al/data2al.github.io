(function() {
  if (window.innerWidth <= 770) {
    var menuBtn = document.querySelector('#headerMenu')
    var nav = document.querySelector('#headerNav')
    menuBtn.onclick = function(e) {
      e.stopPropagation()
      if (menuBtn.classList.contains('active')) {
        menuBtn.classList.remove('active')
        nav.classList.remove('nav-show')
      } else {
        nav.classList.add('nav-show')
        menuBtn.classList.add('active')
      }
    }
    document.querySelector('body').addEventListener('click', function() {
      nav.classList.remove('nav-show')
      menuBtn.classList.remove('active')
    })
  }
}());

(function() {
  var articleCounter = document.querySelector('#articleCounter')

  if (!articleCounter) {
    return
  }

  var count = parseInt(articleCounter.getAttribute('data-count'), 10)
  var label = articleCounter.getAttribute('data-label') || 'Articles'

  if (isNaN(count)) {
    count = 0
  }

  articleCounter.innerHTML =
    '<span class="article-counter-total">' + count + '</span>' +
    '<span class="article-counter-label">' + label + '</span>'
}());

(function() {
  var searchInput = document.querySelector('#siteSearch')
  var searchResults = document.querySelector('#searchResults')
  var searchRoot = document.querySelector('#headerSearch')

  if (!searchInput || !searchResults || !searchRoot) {
    return
  }

  var items = []
  var searchLoaded = false
  var searchLoading = false
  var searchUrl = searchRoot.getAttribute('data-search-url') || '/search.json'

  function loadSearchIndex(callback) {
    if (searchLoaded) {
      callback()
      return
    }

    if (searchLoading) {
      return
    }

    searchLoading = true
    fetch(searchUrl, { credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Search index unavailable')
        }

        return response.json()
      })
      .then(function(data) {
        items = data || []
        searchLoaded = true
        callback()
      })
      .catch(function() {
        items = []
        searchLoaded = true
      })
      .finally(function() {
        searchLoading = false
      })
  }

  function clearResults() {
    searchResults.innerHTML = ''
    searchResults.classList.remove('search-results-show')
  }

  function renderResults(matches) {
    if (!matches.length) {
      searchResults.innerHTML = '<div class="search-empty">No matching articles</div>'
      searchResults.classList.add('search-results-show')
      return
    }

    var html = ''
    for (var i = 0; i < matches.length; i++) {
      var item = matches[i]
      html +=
        '<a class="search-result-item" href="' + item.url + '">' +
        '<span class="search-result-title">' + item.title + '</span>' +
        '<span class="search-result-meta">' + item.category + '</span>' +
        '</a>'
    }

    searchResults.innerHTML = html
    searchResults.classList.add('search-results-show')
  }

  searchInput.addEventListener('input', function() {
    loadSearchIndex(function() {
      var query = searchInput.value.toLowerCase().trim()

      if (!query) {
        clearResults()
        return
      }

      var matches = []
      for (var i = 0; i < items.length; i++) {
        var item = items[i]
        var haystack = (item.title + ' ' + item.summary + ' ' + item.category).toLowerCase()

        if (haystack.indexOf(query) !== -1) {
          matches.push(item)
        }

        if (matches.length === 8) {
          break
        }
      }

      renderResults(matches)
    })
  })

  searchInput.addEventListener('focus', function() {
    loadSearchIndex(function() {})
  })

  searchInput.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      searchInput.blur()
      clearResults()
    }
  })

  document.addEventListener('click', function(event) {
    if (!event.target.closest('#headerSearch')) {
      clearResults()
    }
  })
}());

(function() {
  var scrollButton = document.querySelector('#scrollToTop')

  if (!scrollButton) {
    return
  }

  var scrollButtonVisible = false
  var scrollTicking = false

  function toggleScrollButton() {
    var shouldShow = window.scrollY > 260

    if (shouldShow === scrollButtonVisible) {
      scrollTicking = false
      return
    }

    scrollButtonVisible = shouldShow

    if (shouldShow) {
      scrollButton.classList.add('scroll-to-top-show')
    } else {
      scrollButton.classList.remove('scroll-to-top-show')
    }

    scrollTicking = false
  }

  scrollButton.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  })

  window.addEventListener('scroll', function() {
    if (!scrollTicking) {
      scrollTicking = true
      window.requestAnimationFrame(toggleScrollButton)
    }
  }, { passive: true })
  toggleScrollButton()
}());

(function() {
  var app = document.querySelector('[data-focus-app]')

  if (!app) {
    return
  }

  var storageKey = 'data2alFocusTimer'
  var modes = {
    pomodoro: { label: 'Pomodoro', minutes: 25, next: 'short' },
    short: { label: 'Short Break', minutes: 5, next: 'pomodoro' },
    long: { label: 'Long Break', minutes: 15, next: 'pomodoro' }
  }
  var musicSources = [
    'jfKfPfyJRdk',
    'LvkuwIDPtLc',
    '2hCLfuwGB-4',
    'vYG-E-kfHoI',
    'VuF0Kj1vX98',
    'Ez2ee0TEYP8',
    '3frlf4W0KOc'
  ]
  var defaults = {
    mode: 'pomodoro',
    tasks: [],
    activeTaskId: null,
    musicMuted: true,
    musicVolume: 35,
    musicSource: 'jfKfPfyJRdk',
    completedToday: 0,
    completedDate: new Date().toDateString()
  }
  var state = loadState()
  var remainingSeconds = getDurationSeconds(state.mode)
  var running = false
  var timerId = null
  var modeButtons = app.querySelectorAll('[data-mode]')
  var display = app.querySelector('[data-timer-display]')
  var toggleButton = app.querySelector('[data-timer-toggle]')
  var musicButton = app.querySelector('[data-music-toggle]')
  var musicSource = app.querySelector('[data-music-source]')
  var musicLink = app.querySelector('[data-music-link]')
  var musicVolume = app.querySelector('[data-music-volume]')
  var musicFrame = app.querySelector('[data-youtube-player]')
  var resetButton = app.querySelector('[data-timer-reset]')
  var currentTask = app.querySelector('[data-current-task]')
  var sessionCount = app.querySelector('[data-session-count]')
  var taskForm = app.querySelector('[data-task-form]')
  var taskTitle = app.querySelector('[data-task-title]')
  var taskList = app.querySelector('[data-task-list]')
  var taskSummary = app.querySelector('[data-task-summary]')
  var clearDone = app.querySelector('[data-clear-done]')

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      var merged = {
        mode: saved.mode || defaults.mode,
        tasks: normalizeTasks(saved.tasks),
        activeTaskId: saved.activeTaskId || null,
        musicMuted: typeof saved.musicMuted === 'boolean' ? saved.musicMuted : defaults.musicMuted,
        musicVolume: normalizeVolume(saved.musicVolume),
        musicSource: normalizeMusicSource(saved.musicSource),
        completedToday: saved.completedToday || 0,
        completedDate: saved.completedDate || defaults.completedDate
      }

      if (merged.completedDate !== new Date().toDateString()) {
        merged.completedToday = 0
        merged.completedDate = new Date().toDateString()
      }

      return merged
    } catch (error) {
      return JSON.parse(JSON.stringify(defaults))
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state))
  }

  function normalizeTasks(tasks) {
    if (!Array.isArray(tasks)) {
      return []
    }

    return tasks.map(function(task) {
      return {
        id: task.id || String(Date.now()),
        title: task.title || 'Untitled task',
        done: !!task.done
      }
    })
  }

  function normalizeVolume(volume) {
    var parsed = parseInt(volume, 10)

    if (isNaN(parsed)) {
      return defaults.musicVolume
    }

    return Math.min(100, Math.max(0, parsed))
  }

  function normalizeMusicSource(source) {
    for (var i = 0; i < musicSources.length; i++) {
      if (musicSources[i] === source) {
        return source
      }
    }

    return defaults.musicSource
  }

  function getMusicUrl(videoId) {
    return 'https://www.youtube.com/watch?v=' + videoId
  }

  function getMusicEmbedUrl(videoId) {
    return 'https://www.youtube.com/embed/' + videoId + '?enablejsapi=1&playsinline=1&controls=1&origin=' + encodeURIComponent(window.location.origin)
  }

  function getDurationSeconds(mode) {
    return modes[mode].minutes * 60
  }

  function formatTime(seconds) {
    var minutes = Math.floor(seconds / 60)
    var rest = seconds % 60

    return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0')
  }

  function getActiveTask() {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === state.activeTaskId) {
        return state.tasks[i]
      }
    }

    return null
  }

  function updateDocumentTitle() {
    if (running) {
      document.title = formatTime(remainingSeconds) + ' - ' + modes[state.mode].label
    } else {
      document.title = 'Focus Timer'
    }
  }

  function renderTimer() {
    display.textContent = formatTime(remainingSeconds)
    sessionCount.textContent = state.completedToday

    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].classList.toggle('is-active', modeButtons[i].getAttribute('data-mode') === state.mode)
    }

    var active = getActiveTask()
    if (currentTask) {
      currentTask.textContent = active ? active.title : 'No task selected'
    }
    toggleButton.innerHTML = running
      ? '<i class="fa fa-pause" aria-hidden="true"></i><span>Pause</span>'
      : '<i class="fa fa-play" aria-hidden="true"></i><span>Start</span>'
    musicButton.innerHTML = state.musicMuted
      ? '<i class="fa fa-volume-off" aria-hidden="true"></i>'
      : '<i class="fa fa-volume-up" aria-hidden="true"></i>'
    musicButton.setAttribute('aria-label', state.musicMuted ? 'Unmute music' : 'Mute music')
    musicButton.setAttribute('title', state.musicMuted ? 'Unmute music' : 'Mute music')
    if (musicVolume) {
      musicVolume.value = state.musicVolume
    }
    if (musicSource) {
      musicSource.value = state.musicSource
    }
    if (musicLink && musicSource) {
      musicLink.href = getMusicUrl(state.musicSource)
      musicLink.textContent = musicSource.options[musicSource.selectedIndex].text
    }
    updateDocumentTitle()
  }

  function renderTasks() {
    if (!taskList || !taskSummary) {
      renderTimer()
      return
    }

    if (!state.tasks.length) {
      taskList.innerHTML = '<div class="focus-task-empty">No tasks yet.</div>'
      taskSummary.textContent = ''
      renderTimer()
      return
    }

    var html = ''
    var doneCount = 0

    for (var i = 0; i < state.tasks.length; i++) {
      var task = state.tasks[i]
      var itemClasses = 'focus-task-item'

      if (task.id === state.activeTaskId) {
        itemClasses += ' is-active'
      }

      if (task.done) {
        itemClasses += ' is-done'
        doneCount += 1
      }

      html +=
        '<div class="' + itemClasses + '" data-task-id="' + task.id + '">' +
        '<input class="focus-task-check" type="checkbox" data-task-complete aria-label="Mark task complete"' + (task.done ? ' checked' : '') + '>' +
        '<div>' +
        '<span class="focus-task-title">' + escapeHtml(task.title) + '</span>' +
        '<span class="focus-task-meta">' + (task.done ? 'Complete' : 'Not complete') + (task.id === state.activeTaskId ? ' - Selected' : '') + '</span>' +
        '</div>' +
        '<div class="focus-task-actions">' +
        '<button class="focus-task-mini" type="button" data-task-toggle aria-label="Toggle completed" title="Toggle completed"><i class="fa fa-check" aria-hidden="true"></i></button>' +
        '<button class="focus-task-mini" type="button" data-task-delete aria-label="Delete task" title="Delete task"><i class="fa fa-trash-o" aria-hidden="true"></i></button>' +
        '</div>' +
        '</div>'
    }

    taskList.innerHTML = html
    taskSummary.innerHTML =
      '<span>' + doneCount + ' done</span>' +
      '<span>' + (state.tasks.length - doneCount) + ' open</span>'
    renderTimer()
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function setMode(mode, preserveRemaining) {
    state.mode = mode
    if (!preserveRemaining) {
      remainingSeconds = getDurationSeconds(mode)
    }
    stopTimer()
    saveState()
    renderTimer()
  }

  function startTimer() {
    if (running) {
      return
    }

    running = true
    timerId = window.setInterval(tick, 1000)
    syncMusic()
    renderTimer()
  }

  function stopTimer() {
    running = false
    if (timerId) {
      window.clearInterval(timerId)
      timerId = null
    }
    syncMusic()
  }

  function resetTimer() {
    stopTimer()
    remainingSeconds = getDurationSeconds(state.mode)
    renderTimer()
  }

  function tick() {
    remainingSeconds -= 1

    if (remainingSeconds <= 0) {
      completeSession()
      return
    }

    renderTimer()
  }

  function completeSession() {
    var previousMode = state.mode
    stopTimer()
    beep()

    if (previousMode === 'pomodoro') {
      state.completedToday += 1
      state.mode = state.completedToday % 4 === 0 ? 'long' : modes[previousMode].next
    } else {
      state.mode = modes[previousMode].next
    }

    remainingSeconds = getDurationSeconds(state.mode)
    saveState()
    renderTasks()
  }

  function toggleMusic() {
    state.musicMuted = !state.musicMuted
    saveState()
    syncMusic()
    renderTimer()
  }

  function syncMusic() {
    if (running) {
      startMusic()
    } else {
      stopMusic()
    }
  }

  function startMusic() {
    setMusicVolume()
    postToMusicPlayer(state.musicMuted ? 'mute' : 'unMute')
    postToMusicPlayer('playVideo')
  }

  function stopMusic() {
    postToMusicPlayer('mute')
    postToMusicPlayer('pauseVideo')
  }

  function postToMusicPlayer(func, args) {
    if (!musicFrame || !musicFrame.contentWindow) {
      return
    }

    musicFrame.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: func,
      args: args || []
    }), '*')
  }

  function setMusicVolume() {
    postToMusicPlayer('setVolume', [state.musicVolume])
  }

  function setMusicSource(videoId) {
    state.musicSource = normalizeMusicSource(videoId)
    saveState()

    if (musicFrame) {
      musicFrame.src = getMusicEmbedUrl(state.musicSource)
    }

    renderTimer()
  }

  function beep() {
    var AudioContext = window.AudioContext || window.webkitAudioContext

    if (!AudioContext) {
      return
    }

    var context = new AudioContext()
    var oscillator = context.createOscillator()
    var gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.5)
  }

  function findTaskElement(target) {
    return target.closest('[data-task-id]')
  }

  function findTask(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === id) {
        return state.tasks[i]
      }
    }

    return null
  }

  for (var i = 0; i < modeButtons.length; i++) {
    modeButtons[i].addEventListener('click', function(event) {
      setMode(event.currentTarget.getAttribute('data-mode'))
    })
  }

  toggleButton.addEventListener('click', function() {
    if (running) {
      stopTimer()
      renderTimer()
    } else {
      startTimer()
    }
  })

  musicButton.addEventListener('click', toggleMusic)

  if (musicVolume) {
    musicVolume.addEventListener('input', function(event) {
      state.musicVolume = normalizeVolume(event.currentTarget.value)
      saveState()
      setMusicVolume()
    })
  }

  if (musicSource) {
    musicSource.addEventListener('change', function(event) {
      setMusicSource(event.currentTarget.value)
    })
  }

  if (musicFrame) {
    musicFrame.addEventListener('load', function() {
      setMusicVolume()
      postToMusicPlayer('mute')
      if (running) {
        startMusic()
      }
    })
    musicFrame.src = getMusicEmbedUrl(state.musicSource)
  }

  resetButton.addEventListener('click', resetTimer)

  if (taskForm && taskTitle && taskList && clearDone) {
    taskForm.addEventListener('submit', function(event) {
      event.preventDefault()

      var title = taskTitle.value.trim()

      if (!title) {
        return
      }

      var task = {
        id: String(Date.now()),
        title: title,
        done: false
      }

      state.tasks.unshift(task)
      state.activeTaskId = task.id
      taskTitle.value = ''
      saveState()
      renderTasks()
    })

    taskList.addEventListener('click', function(event) {
      var item = findTaskElement(event.target)

      if (!item) {
        return
      }

      var id = item.getAttribute('data-task-id')
      var task = findTask(id)

      if (!task) {
        return
      }

      if (event.target.closest('[data-task-toggle]')) {
        task.done = !task.done
      } else if (event.target.closest('[data-task-delete]')) {
        state.tasks = state.tasks.filter(function(candidate) {
          return candidate.id !== id
        })
        if (state.activeTaskId === id) {
          state.activeTaskId = state.tasks.length ? state.tasks[0].id : null
        }
      } else if (!event.target.matches('[data-task-complete]')) {
        state.activeTaskId = id
      }

      saveState()
      renderTasks()
    })

    taskList.addEventListener('change', function(event) {
      if (!event.target.matches('[data-task-complete]')) {
        return
      }

      var item = findTaskElement(event.target)
      var task = item ? findTask(item.getAttribute('data-task-id')) : null

      if (!task) {
        return
      }

      task.done = event.target.checked
      saveState()
      renderTasks()
    })

    clearDone.addEventListener('click', function() {
      state.tasks = state.tasks.filter(function(task) {
        return !task.done
      })

      if (state.activeTaskId && !findTask(state.activeTaskId)) {
        state.activeTaskId = state.tasks.length ? state.tasks[0].id : null
      }

      saveState()
      renderTasks()
    })
  }

  renderTasks()
}());
