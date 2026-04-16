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
  var searchData = document.querySelector('#searchData')

  if (!searchInput || !searchResults || !searchData) {
    return
  }

  var items = []

  try {
    items = JSON.parse(searchData.textContent)
  } catch (error) {
    items = []
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

  function toggleScrollButton() {
    if (window.scrollY > 260) {
      scrollButton.classList.add('scroll-to-top-show')
    } else {
      scrollButton.classList.remove('scroll-to-top-show')
    }
  }

  scrollButton.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  })

  window.addEventListener('scroll', toggleScrollButton)
  toggleScrollButton()
}());

(function() {
  var lock = document.querySelector('[data-scribbles-lock]')
  var content = document.querySelector('[data-scribbles-content]')
  var form = document.querySelector('[data-scribbles-form]')
  var error = document.querySelector('[data-scribbles-error]')
  var protectedPage = document.querySelector('[data-scribbles-protected]')
  var passcode = '2077'
  var authKey = 'scribblesUnlocked'
  var directoryPath = '/scribbles/'

  if (protectedPage) {
    if (window.localStorage.getItem(authKey) === 'true') {
      return
    }

    var nextPath = encodeURIComponent(window.location.pathname)
    window.location.href = directoryPath + '?next=' + nextPath
    return
  }

  if (!lock || !content || !form) {
    return
  }

  function unlock() {
    lock.setAttribute('hidden', 'hidden')
    content.removeAttribute('hidden')
  }

  if (window.localStorage.getItem(authKey) === 'true') {
    unlock()
    return
  }

  form.addEventListener('submit', function(event) {
    event.preventDefault()

    var input = document.querySelector('#scribblesPasscode')
    if (!input) {
      return
    }

    if (input.value === passcode) {
      window.localStorage.setItem(authKey, 'true')
      var params = new URLSearchParams(window.location.search)
      var next = params.get('next')
      if (next) {
        window.location.href = next
        return
      }
      unlock()
      return
    }

    if (error) {
      error.removeAttribute('hidden')
    }

    input.value = ''
    input.focus()
  })
}());
