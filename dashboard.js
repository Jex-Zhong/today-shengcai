(function (root) {
  'use strict';
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var YIREN_VISIBLE_LIMIT = 5;
  var SECTION_NAMES = ['亦仁', 'AI', '内容', '电商'];
  function validDate(value) {
    if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
    var parts = value.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toISOString().slice(0, 10) === value;
  }
  function sortIssues(issues) {
    return Array.isArray(issues) ? issues.slice().sort(function (a, b) {
      return String(b && b.date || '').localeCompare(String(a && a.date || ''));
    }) : [];
  }
  function resolveIssueDate(issues, requested) {
    var valid = sortIssues(issues).filter(function (issue) { return issue && validDate(issue.date); });
    if (!valid.length) return null;
    return valid.some(function (issue) { return issue.date === requested; }) ? requested : valid[0].date;
  }
  function getAdjacentDates(issues, current) {
    var dates = sortIssues(issues).filter(function (issue) { return issue && validDate(issue.date); }).map(function (issue) { return issue.date; });
    var index = dates.indexOf(current);
    return { previous: index >= 0 && index < dates.length - 1 ? dates[index + 1] : null, next: index > 0 ? dates[index - 1] : null };
  }
  function buildDateUrl(first, second) {
    var date, href;
    if (typeof first === 'string' && (/^[a-z][a-z\d+.-]*:/i.test(first)
      || first.indexOf('?') >= 0 || first.indexOf('#') >= 0)) {
      href = first;
      date = second;
    } else {
      date = first;
      href = second;
    }
    try {
      var url = new URL(href || '', root.location && root.location.href || 'http://localhost/');
      url.searchParams.set('date', date);
      return url.toString();
    } catch (_) {
      return href || '';
    }
  }
  function getYirenView(articles, expanded) {
    var items = Array.isArray(articles) ? articles : [];
    var isExpanded = items.length > YIREN_VISIBLE_LIMIT && expanded === true;
    return {
      visible: (isExpanded ? items : items.slice(0, YIREN_VISIBLE_LIMIT)).slice(),
      remaining: isExpanded ? 0 : Math.max(0, items.length - YIREN_VISIBLE_LIMIT),
      expanded: isExpanded
    };
  }
  root.TODAY_SHENGCAI_DASHBOARD_API = { sortIssues: sortIssues, resolveIssueDate: resolveIssueDate, getAdjacentDates: getAdjacentDates, buildDateUrl: buildDateUrl, getYirenView: getYirenView };
  if (typeof document === 'undefined') return;
  function isUsableIssue(issue) { return issue && validDate(issue.date) && issue.sections && typeof issue.sections === 'object'; }
  var rawIssues = Array.isArray(root.TODAY_SHENGCAI_ISSUES) ? root.TODAY_SHENGCAI_ISSUES : [];
  var sorted = sortIssues(rawIssues.filter(isUsableIssue));
  var select = document.getElementById('issue-date');
  var previous = document.getElementById('previous-issue');
  var next = document.getElementById('next-issue');
  var yirenExpanded = false;
  function text(tag, value, className) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value == null ? '' : String(value);
    return element;
  }
  function fmtDate(value) {
    var parts = value.split('-').map(Number);
    var day = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
    return value + ' · 周' + ['日', '一', '二', '三', '四', '五', '六'][day];
  }
  function fmtTime(value) {
    if (!value) return '未提供';
    var date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '未提供';
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short'
    }).format(date);
  }
  function safeStats(article) {
    var stats = article && article.stats && typeof article.stats === 'object'
      ? article.stats
      : {};
    return [['阅读', stats.reads], ['点赞', stats.likes],
      ['收藏', stats.favorites], ['投币', stats.coins]];
  }
  function renderCard(article, index) {
    article = article && typeof article === 'object' ? article : {};
    var title = article.title || '未命名文章';
    var card = text('article', '', 'article-card');
    if (article.id != null) card.dataset.topicId = String(article.id);
    var meta = text('div', '', 'meta');
    meta.append(
      text('span', article.author || '未知作者', 'author'),
      text('span', '精选 ' + String(index + 1).padStart(2, '0'))
    );
    card.append(
      meta,
      text('p', Array.isArray(article.tags) ? article.tags.join(' · ') : '暂无标签', 'tags'),
      text('h3', title),
      text('p', '推荐理由：' + (article.why || '暂无推荐理由'), 'reason'),
      text('p', article.summary || '暂无摘要', 'summary')
    );
    var stats = text('div', '', 'stats');
    safeStats(article).forEach(function (item) { stats.append(text('span', item[0] + ' ' + (item[1] == null ? '—' : item[1]))); });
    card.append(stats);
    var link = text('a', '读原帖', 'read-link');
    if (typeof article.url === 'string'
      && article.url.indexOf('https://scys.com/articleDetail/') === 0) {
      link.href = article.url;
    }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', '读原帖：' + title + '（新标签页打开）');
    card.append(link);
    return card;
  }
  function renderSection(issue, name, total) {
    var section = document.querySelector('[data-section="' + name + '"]');
    var cards = section.querySelector('.cards');
    var articles = Array.isArray(issue.sections[name]) ? issue.sections[name] : [];
    section.hidden = false; cards.replaceChildren();
    articles.forEach(function (article, index) { cards.append(renderCard(article, index)); total.value += 1; });
    var count = document.querySelector('[data-count="' + name + '"]'); if (count) count.textContent = String(articles.length);
  }
  function renderYiren(issue, total) {
    var articles = Array.isArray(issue.sections['亦仁']) ? issue.sections['亦仁'] : [];
    var view = getYirenView(articles, yirenExpanded);
    var section = document.getElementById('yiren');
    var cards = document.getElementById('yiren-cards');
    var toggle = document.getElementById('yiren-toggle');
    section.hidden = false;
    cards.replaceChildren();
    view.visible.forEach(function (article, index) { cards.append(renderCard(article, index)); });
    total.value += articles.length;
    document.querySelector('[data-count="亦仁"]').textContent = String(articles.length);
    document.getElementById('yiren-total').textContent = '全部更新 · ' + articles.length + ' 篇';
    document.getElementById('yiren-empty').hidden = articles.length !== 0;
    toggle.hidden = articles.length <= YIREN_VISIBLE_LIMIT;
    toggle.textContent = view.expanded ? '收起' : '展开更多（' + view.remaining + ' 篇）';
    toggle.setAttribute('aria-expanded', String(view.expanded));
  }
  function renderEmpty() {
    yirenExpanded = false;
    select.replaceChildren(); select.disabled = true; previous.disabled = true; next.disabled = true;
    document.getElementById('issue-date-label').textContent = ''; document.getElementById('time-range').textContent = ''; document.getElementById('generated-at').textContent = '';
    document.getElementById('overview-total').textContent = '0 篇概览'; document.getElementById('empty-state').hidden = false;
    document.querySelectorAll('.overview > a').forEach(function (link) { link.hidden = true; });
    SECTION_NAMES.forEach(function (name) { document.querySelector('[data-section="' + name + '"]').hidden = true; var count = document.querySelector('[data-count="' + name + '"]'); if (count) count.textContent = '0'; });
    document.getElementById('yiren-cards').replaceChildren();
    document.getElementById('yiren-total').textContent = '全部更新 · 0 篇';
    document.getElementById('yiren-empty').hidden = true;
    var toggle = document.getElementById('yiren-toggle'); toggle.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = '';
    document.title = '今日生财｜暂无可用期次';
  }
  function render(date, updateUrl) {
    var issue = sorted.filter(function (item) { return item.date === date; })[0];
    if (!issue) return renderEmpty();
    yirenExpanded = false;
    var adjacent = getAdjacentDates(sorted, date); select.disabled = false; document.getElementById('empty-state').hidden = true;
    document.querySelectorAll('.overview > a').forEach(function (link) { link.hidden = false; }); select.value = date;
    document.getElementById('issue-date-label').textContent = fmtDate(date); previous.disabled = !adjacent.previous; next.disabled = !adjacent.next;
    document.getElementById('time-range').textContent = '北京时间 ' + fmtTime(issue.windowStart) + '–' + fmtTime(issue.windowEnd) + '。';
    document.getElementById('generated-at').textContent = '成功更新时间：' + fmtTime(issue.generatedAt) + '。';
    var total = { value: 0 }; renderYiren(issue, total); SECTION_NAMES.slice(1).forEach(function (name) { renderSection(issue, name, total); });
    document.getElementById('overview-total').textContent = total.value + ' 篇概览'; document.title = '今日生财｜' + date + ' 精选阅读';
    if (updateUrl) history.pushState({}, '', buildDateUrl(date, location.href));
  }
  sorted.forEach(function (issue) { var option = text('option', issue.date); option.value = issue.date; select.append(option); });
  var requested; try { requested = new URL(location.href).searchParams.get('date'); } catch (_) { requested = null; }
  var current = resolveIssueDate(sorted, requested);
  if (current) { if (requested !== current) history.replaceState({}, '', buildDateUrl(current, location.href)); render(current, false); } else { renderEmpty(); }
  select.addEventListener('change', function () { render(select.value, true); });
  previous.addEventListener('click', function () { var adjacent = getAdjacentDates(sorted, select.value); if (adjacent.previous) render(adjacent.previous, true); });
  next.addEventListener('click', function () { var adjacent = getAdjacentDates(sorted, select.value); if (adjacent.next) render(adjacent.next, true); });
  document.getElementById('yiren-toggle').addEventListener('click', function () {
    var issue = sorted.filter(function (item) { return item.date === select.value; })[0];
    if (!issue) return;
    yirenExpanded = !yirenExpanded;
    renderYiren(issue, { value: 0 });
    if (!yirenExpanded) document.getElementById('yiren').scrollIntoView({ block: 'start' });
  });
  root.addEventListener('popstate', function () { var requestedDate; try { requestedDate = new URL(location.href).searchParams.get('date'); } catch (_) { requestedDate = null; } var resolved = resolveIssueDate(sorted, requestedDate); if (resolved && requestedDate !== resolved) history.replaceState({}, '', buildDateUrl(resolved, location.href)); render(resolved, false); });
}(typeof globalThis !== 'undefined' ? globalThis : window));
