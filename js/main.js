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
