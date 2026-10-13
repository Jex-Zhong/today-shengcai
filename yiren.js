(function (root) {
  'use strict';

  var PAGE_SIZE = 20;
  var MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
  var PUBLISHED_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-/;

  function normalizeQuery(value) {
    return String(value == null ? '' : value)
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('zh-CN');
  }

  function validMonth(value) {
    var match = MONTH_PATTERN.exec(String(value == null ? '' : value));
    return match !== null && Number(match[1]) >= 2026;
  }

  function postMonth(post) {
    var match = PUBLISHED_MONTH_PATTERN.exec(String(post && post.publishedAt || ''));
    if (match === null || Number(match[1]) < 2026) return '';
    return match[1] + '-' + match[2];
  }

  function filterPosts(posts, options) {
    var source = Array.isArray(posts) ? posts : [];
    var settings = options !== null && typeof options === 'object' && !Array.isArray(options) ? options : {};
    var needle = normalizeQuery(settings.query);
    var selectedMonth = String(settings.month == null ? '' : settings.month);
    if (selectedMonth && !validMonth(selectedMonth)) return [];

    return source.filter(function (post) {
      if (selectedMonth && postMonth(post) !== selectedMonth) return false;
      if (!needle) return true;

      var item = post || {};
      var tags = Array.isArray(item.tags) ? item.tags : [];
      var searchable = [item.title, item.summary].concat(tags);
      return searchable.some(function (value) {
        return normalizeQuery(value).includes(needle);
      });
    });
  }

  function getPage(posts, count) {
    var source = Array.isArray(posts) ? posts : [];
    var requested = Number(count);
    var visibleCount = Number.isFinite(requested) ? Math.max(PAGE_SIZE, Math.floor(requested)) : PAGE_SIZE;
    var visible = source.slice(0, visibleCount);
    return { visible: visible, hasMore: visible.length < source.length, total: source.length };
  }

  function getMonths(posts) {
    var source = Array.isArray(posts) ? posts : [];
    var seen = Object.create(null);
    var months = [];
    source.forEach(function (post) {
      var month = postMonth(post);
      if (month && !seen[month]) {
        seen[month] = true;
        months.push(month);
      }
    });
    return months;
  }

  function isAllowedArticleUrl(value, id) {
    if (typeof value !== 'string' || typeof id !== 'string') return false;
    var match = /^https:\/\/scys\.com\/articleDetail\/(xq_topic|forum_topic)\/([0-9]+)$/.exec(value);
    return match !== null && match[0] === value && match[2] === id;
  }

  function isNonEmpty(value) {
    return String(value == null ? '' : value).trim().length > 0;
  }

  function isValidPost(post) {
    if (post === null || typeof post !== 'object' || Array.isArray(post)) return false;
    if (!isNonEmpty(post.id) || !isNonEmpty(post.title) || !isNonEmpty(post.summary)) return false;
    if (post.author !== '亦仁' || post.authorId !== '36389') return false;
    var publishedTime = Date.parse(String(post.publishedAt == null ? '' : post.publishedAt));
    if (!Number.isFinite(publishedTime) || publishedTime < Date.parse('2026-01-01T00:00:00+08:00')) return false;
    if (!Array.isArray(post.tags)) return false;
    if (post.stats === null || typeof post.stats !== 'object' || Array.isArray(post.stats)) return false;
    if (!['reads', 'likes', 'favorites', 'coins'].every(function (name) {
      return Number.isInteger(post.stats[name]) && post.stats[name] >= 0;
    })) return false;
    return isAllowedArticleUrl(post.url, post.id);
  }

  root.TODAY_SHENGCAI_YIREN_API = {
    filterPosts: filterPosts,
    getPage: getPage,
    getMonths: getMonths,
    isValidPost: isValidPost
  };

  if (typeof document === 'undefined') return;

  var searchInput = document.getElementById('yiren-search');
  var monthSelect = document.getElementById('yiren-month');
  var list = document.getElementById('yiren-list');
  var loadMore = document.getElementById('yiren-load-more');
  var emptyState = document.getElementById('yiren-empty');
  var errorState = document.getElementById('yiren-error');
  var totalStatus = document.getElementById('yiren-total');
  var resultStatus = document.getElementById('yiren-results');
  var posts = root.TODAY_SHENGCAI_YIREN_POSTS;
  var visibleCount = PAGE_SIZE;

  function appendTextElement(parent, tagName, className, value) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = String(value == null ? '' : value);
    parent.appendChild(element);
    return element;
  }

  function clearElement(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function safeArticleUrl(value, id) {
    return isAllowedArticleUrl(value, id) ? value : '';
  }

  function statValue(value) {
    return Number.isInteger(value) && value >= 0 ? String(value) : '—';
  }

  function renderPost(post) {
    var item = post || {};
    var card = document.createElement('li');
    card.className = 'post-card';

    var heading = document.createElement('div');
    heading.className = 'post-heading';
    appendTextElement(heading, 'h2', 'post-title', item.title || '未命名文章');
    appendTextElement(heading, 'time', 'post-date', String(item.publishedAt || '').slice(0, 10) || '日期未知');
    card.appendChild(heading);

    if (item.summary) appendTextElement(card, 'p', 'post-summary', item.summary);
    if (Array.isArray(item.tags) && item.tags.length) {
      var tags = document.createElement('ul');
      tags.className = 'post-tags';
      item.tags.forEach(function (tag) {
        appendTextElement(tags, 'li', 'post-tag', tag);
      });
      card.appendChild(tags);
    }

    var stats = item.stats || {};
    var statsList = document.createElement('ul');
    statsList.className = 'post-stats';
    [['阅读', stats.reads], ['点赞', stats.likes], ['收藏', stats.favorites], ['投币', stats.coins]].forEach(function (entry) {
      appendTextElement(statsList, 'li', 'post-stat', entry[0] + ' ' + statValue(entry[1]));
    });
    card.appendChild(statsList);

    var url = safeArticleUrl(item.url, item.id);
    if (url) {
      var link = appendTextElement(card, 'a', 'post-link', '阅读原帖');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return card;
  }

  function render() {
    if (!Array.isArray(posts) || posts.some(function (post) { return !isValidPost(post); })) {
      clearElement(list);
      totalStatus.textContent = '文章总数 · 数据不可用';
      resultStatus.textContent = '无法显示结果';
      errorState.hidden = false;
      emptyState.hidden = true;
      loadMore.hidden = true;
      return;
    }

    errorState.hidden = true;
    totalStatus.textContent = '文章总数 · ' + posts.length + ' 篇';
    var filtered = filterPosts(posts, { query: searchInput.value, month: monthSelect.value });
    var page = getPage(filtered, visibleCount);
    clearElement(list);
    page.visible.forEach(function (post) {
      list.appendChild(renderPost(post));
    });

    var hasFilters = Boolean(searchInput.value.trim() || monthSelect.value);
    if (page.total === 0) {
      emptyState.textContent = hasFilters ? '没有匹配的文章，请调整搜索或月份。' : '文章库暂时为空。';
      emptyState.hidden = false;
      resultStatus.textContent = hasFilters ? '0 条匹配结果' : '0 条结果';
    } else {
      emptyState.hidden = true;
      resultStatus.textContent = page.hasMore
        ? page.total + ' 条匹配结果 · 已显示 ' + page.visible.length + ' 条'
        : page.total + ' 条匹配结果 · 已显示全部';
    }
    loadMore.hidden = !page.hasMore;
  }

  function resetAndRender() {
    visibleCount = PAGE_SIZE;
    render();
  }

  if (Array.isArray(posts)) {
    getMonths(posts).forEach(function (month) {
      var option = document.createElement('option');
      option.value = month;
      option.textContent = month;
      monthSelect.appendChild(option);
    });
  }

  searchInput.addEventListener('input', resetAndRender);
  monthSelect.addEventListener('change', resetAndRender);
  loadMore.addEventListener('click', function () {
    visibleCount += PAGE_SIZE;
    render();
  });
  render();
}(typeof globalThis === 'object' ? globalThis : this));
