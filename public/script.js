// 아래 가상 자료는 화면 확인용으로 보존하며 실제 검색에서는 사용하지 않습니다.
const FRAMES = ['갈등', '인간적 흥미', '경제적 결과', '도덕성', '책임 귀인', '판단 보류'];
const SENTIMENTS = ['긍정', '중립', '부정'];
const examples = [
  ['최저임금 인상폭 놓고 노사 정면충돌', '가상일보', '갈등', '부정', '높음', '노사 간 대립을 중심으로 표현합니다.'],
  ['“월세 내면 남는 게 없어요”…노동자의 하루', '예시신문', '인간적 흥미', '부정', '높음', '개인의 일상과 어려움으로 공감을 유도합니다.'],
  ['최저임금 인상 시 소상공인 인건비 부담 증가 전망', '모형경제', '경제적 결과', '부정', '높음', '인건비라는 경제적 비용을 강조합니다.'],
  ['최저임금은 인간다운 삶을 위한 사회의 도덕적 의무', '가상일보', '도덕성', '중립', '높음', '인간다운 삶과 도덕적 의무라는 가치를 강조합니다.'],
  ['저임금 문제 해결, 정부의 근로감독 강화 필요', '예시신문', '책임 귀인', '중립', '높음', '정부에 문제 해결을 위한 조치를 요구합니다.'],
  ['내년도 최저임금 심의 일정 발표', '모형경제', '판단 보류', '중립', '높음', '일정 전달만으로 대표 프레임을 판단하기 어렵습니다.'],
  ['임금 상승에 소비 회복 기대…지역 상권에 온기', '모형경제', '경제적 결과', '긍정', '높음', '소비와 지역 상권에 대한 경제적 영향을 강조합니다.'],
  ['최저임금 결정 방식 두고 여야 공방', '가상일보', '갈등', '부정', '높음', '정당 사이의 충돌과 공방을 강조합니다.'],
  ['첫 월급에 웃음 되찾은 청년의 이야기', '예시신문', '인간적 흥미', '긍정', '중간', '개인의 경험과 감정이 중심이지만 구체적 맥락은 부족합니다.'],
  ['최저임금 인상, 영세업체 비용에 미칠 영향은', '모형경제', '경제적 결과', '중립', '중간', '업체의 경제적 영향을 묻지만 방향은 확정하지 않습니다.']
];
const articles = examples.map(([title, publisher, frame, sentiment, confidence, reason], index) => ({
  id: index + 1, title, originalTitle: `${title} - ${publisher}`, publisher,
  publishedAt: `2026-10-${28 - Math.floor(index / 2)}T09:00:00+09:00`,
  url: `https://example.com/#article-${index + 1}`, frame, sentiment, confidence, reason
}));
const counts = (items, field, labels) => Object.fromEntries(labels.map(label => [label, items.filter(item => item[field] === label).length]));

// 화면 확인용 미사용 자료입니다. 실제 검색에서는 서버 응답만 사용합니다.
const MOCK_RESPONSE = {
  ok: true, keyword: '최저임금',
  meta: { collectedAt: '2026-10-28T12:00:00+09:00', analyzedAt: '2026-10-28T12:00:10+09:00', periodDays: 7, maxArticles: 30, receivedCount: 10, dateExcludedCount: 0, duplicateExcludedCount: 0, articleCount: 10, model: 'gpt-6-luna', methodVersion: '1.0', analysisScope: '헤드라인' },
  articles,
  distribution: { frames: counts(articles, 'frame', FRAMES), sentiments: counts(articles, 'sentiment', SENTIMENTS) },
  publisherComparison: [...new Set(articles.map(item => item.publisher))].map(publisher => {
    const selected = articles.filter(item => item.publisher === publisher);
    return { publisher, articleCount: selected.length, frames: counts(selected, 'frame', FRAMES) };
  }),
  representatives: FRAMES.map(frame => {
    const selected = articles.filter(item => item.frame === frame);
    const first = selected[0];
    const second = selected.find(item => item.publisher !== first?.publisher) || selected[1];
    return { frame, articleIds: [first, second].filter(Boolean).map(item => item.id) };
  }),
  summary: ['가상 기사 10건에서는 경제적 결과 프레임이 3건으로 가장 많습니다.', '갈등과 인간적 흥미 프레임은 각각 2건이며, 감성은 중립이 4건으로 가장 많습니다.', '언론사별 기사 수가 적으므로 이 자료로 언론사의 전체 성향을 판단하기는 어렵습니다.'],
  additionalPerspective: { text: '최저임금 변화가 노동시간과 일자리의 질에 미치는 영향을 추가로 살펴볼 수 있습니다.', qualification: '수집된 제목만을 바탕으로 한 제안입니다.' },
  warnings: ['실제 뉴스나 AI 응답이 아닌 가상 데이터입니다.']
};

const byId = id => document.getElementById(id);
let currentResult = null;
let researcherResult = null;
let isLoading = false;
let collectedResult = null;
let collectionValid = false;
let showPublishers = false;
function keywordChanged() {
  if (collectedResult) {
    collectionValid = false;
    byId('status').textContent = '키워드가 바뀌었습니다. 다시 수집해 주세요.';
  }
  byId('reveal-button').disabled = true;
}
const RECENT_SEARCH_KEY = 'frameLens.recentSearches';
let recentSearches = readRecentSearches();
function readRecentSearches() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter(value => typeof value === 'string').map(value => value.trim()).filter(value => value.length > 0 && value.length <= 100))].slice(0, 5);
  } catch { return []; }
}
function renderRecentSearches() {
  byId('recent-buttons').replaceChildren();
  recentSearches.forEach(keyword => {
    const button = element('button', keyword);
    button.type = 'button'; button.disabled = isLoading;
    button.addEventListener('click', () => {
      if (isLoading) return;
      byId('keyword').value = keyword;
      keywordChanged(); byId('keyword').focus();
    });
    byId('recent-buttons').append(button);
  });
  byId('recent-empty').hidden = recentSearches.length > 0;
  byId('clear-recent').disabled = isLoading || recentSearches.length === 0;
}
function saveRecentSearch(keyword) {
  recentSearches = [keyword, ...recentSearches.filter(value => value !== keyword)].slice(0, 5);
  try {
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches));
    byId('recent-status').textContent = '';
  } catch {
    byId('recent-status').textContent = '검색 기록을 이 브라우저에 저장하지 못했습니다. 현재 화면에서만 유지됩니다.';
  }
  renderRecentSearches();
}
let copyTimer;
let copyGeneration = 0;
function tsvCell(value) {
  const cleaned = String(value ?? '').replace(/[\t\r\n]/g, ' ');
  // 스프레드시트가 복사한 제목을 수식으로 실행하지 않게 합니다.
  return /^\s*[=+@-]/.test(cleaned) ? `'${cleaned}` : cleaned;
}
function buildTsv(items, mode) {
  const headers = mode === 'manual' ? ['번호', '제목', '내 분류'] : ['번호', '제목', '언론사', 'AI 프레임', '감성', '확신도', '근거'];
  const rows = items.map(a => mode === 'manual' ? [a.id, a.title, ''] : [a.id, a.title, a.publisher, a.frame, a.sentiment, a.confidence, a.reason]);
  return [headers, ...rows].map(row => row.map(tsvCell).join('\t')).join('\r\n');
}
function resetCopyUi() {
  copyGeneration += 1;
  clearTimeout(copyTimer);
  byId('copy-status').textContent = '';
  byId('copy-fallback').hidden = true;
  byId('copy-text').value = '';
}
async function copyResults(mode) {
  const items = mode === 'manual' ? collectedResult?.articles : researcherResult?.articles;
  if (isLoading || !items?.length) return;
  const generation = copyGeneration;
  const text = buildTsv(items, mode);
  const count = items.length;
  clearTimeout(copyTimer);
  try {
    await navigator.clipboard.writeText(text);
    if (generation !== copyGeneration) return;
    byId('copy-fallback').hidden = true;
    byId('copy-status').textContent = `복사했습니다 (${count}건)`;
    copyTimer = setTimeout(() => { byId('copy-status').textContent = ''; }, 2500);
  } catch {
    if (generation !== copyGeneration) return;
    byId('copy-status').textContent = '자동 복사가 되지 않았습니다. 아래 내용을 선택해 복사해 주세요.';
    byId('copy-fallback').hidden = false;
    byId('copy-text').value = text;
    byId('copy-text').focus(); byId('copy-text').select();
  }
}
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copyResults(button.dataset.copy)));
function articleLink(item) {
  try {
    const url = new URL(item.url);
    if (!['https:', 'http:'].includes(url.protocol)) return element('span', '링크 없음', 'muted');
    const link = element('a', '기사 보기');
    link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${item.title} — 기사 보기`);
    return link;
  } catch { return element('span', '링크 없음', 'muted'); }
}
function renderScopeNotice(data) {
  const meta = data.meta;
  const total = meta.totalAnalyzedCount;
  byId('scope-notice').textContent = `수집 ${total}건 중 해외 이슈로 판단된 ${meta.overseasExcludedCount}건을 제외하고 ${data.articles.length}건을 분석했습니다.${meta.unknownScopeCount ? ` 지역 판단 불가 ${meta.unknownScopeCount}건 포함.` : ''}`;
  byId('scope-detail').textContent = `위 수집 건수는 AI 지역 판정 대상입니다. RSS 원래 ${meta.receivedCount}건 중 날짜·중복 등을 정리한 표본을 사용했습니다.${meta.serverScopeCorrectionCount ? ` 서버 지역 보정 ${meta.serverScopeCorrectionCount}건이 포함됩니다.` : ''}`;
  const excluded = data.excludedArticles || [];
  byId('excluded-section').hidden = excluded.length === 0;
  byId('excluded-section').open = false;
  byId('excluded-rows').replaceChildren();
  excluded.forEach(item => {
    const row = element('tr');
    cell(row, item.id); cell(row, item.title, 'title-cell'); cell(row, item.publisher);
    cell(row, articleLink(item)); cell(row, item.scopeReason, 'reason-cell');
    byId('excluded-rows').append(row);
  });
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function badge(frame) { return element('span', frame, `badge frame-${FRAMES.indexOf(frame)}`); }
function percent(count, total) { return total ? `${Math.round(count / total * 100)}%` : '0%'; }
function cell(row, text, className) {
  const td = element('td', undefined, className);
  td.append(text instanceof Node ? text : document.createTextNode(String(text)));
  row.append(td);
}
function renderTitles(data) {
  byId('title-rows').replaceChildren();
  data.articles.forEach(item => {
    const row = element('tr');
    cell(row, item.id); cell(row, item.title, 'title-cell');
    if (showPublishers) cell(row, item.publisher);
    byId('title-rows').append(row);
  });
}
function renderChart(id, labels, values, total, prefix) {
  const container = byId(id);
  container.replaceChildren();
  labels.forEach((label, index) => {
    const row = element('div', undefined, `bar-row ${prefix}-${index}`);
    const caption = element('div', undefined, 'bar-label');
    caption.append(element('span', label), element('span', `${values[label]}건 · ${percent(values[label], total)}`));
    const track = element('div', undefined, 'track');
    track.setAttribute('aria-hidden', 'true');
    const fill = element('div', undefined, 'fill');
    fill.style.width = percent(values[label], total);
    track.append(fill); row.append(caption, track); container.append(row);
  });
}
function renderAnalysis(data) {
  const total = data.articles.length;
  const largest = Math.max(...Object.values(data.distribution.frames));
  const leading = FRAMES.filter(frame => data.distribution.frames[frame] === largest).join(' · ');
  byId('summary-numbers').replaceChildren();
  [['분석 기사 수', `${total}건`], ['언론사 수', `${data.publisherComparison.length}곳`], ['가장 많은 프레임', leading]].forEach(([label, value]) => {
    const card = element('div', undefined, 'stat'); card.append(element('span', label), element('strong', value)); byId('summary-numbers').append(card);
  });
  renderChart('frame-chart', FRAMES, data.distribution.frames, total, 'frame');
  renderChart('sentiment-chart', SENTIMENTS, data.distribution.sentiments, total, 'sentiment');
  renderFrameStrip(data);
  const table = byId('publisher-table'); table.replaceChildren();
  const head = element('thead'); const header = element('tr');
  ['언론사', '기사 수', ...FRAMES].forEach((label, index) => {
    const th = element('th'); th.scope = 'col'; th.append(index > 1 ? badge(label) : document.createTextNode(label)); header.append(th);
  });
  head.append(header); const body = element('tbody');
  data.publisherComparison.forEach(item => {
    const row = element('tr'); cell(row, item.publisher); cell(row, `${item.articleCount}건`);
    FRAMES.forEach(frame => cell(row, `${item.frames[frame]}건 (${percent(item.frames[frame], item.articleCount)})`)); body.append(row);
  });
  table.append(head, body);
  byId('representatives').replaceChildren();
  data.representatives.forEach(group => {
    if (!group.articleIds.length) return;
    const card = element('div', undefined, 'representative'); card.append(badge(group.frame));
    const list = element('ul');
    group.articleIds.slice(0, 2).forEach(id => {
      const item = data.articles.find(article => article.id === id);
      if (!item) return;
      const li = element('li'); li.append(element('p', item.title), element('span', `${item.publisher} · `, 'muted'));
      li.append(articleLink(item));
      list.append(li);
    });
    card.append(list); byId('representatives').append(card);
  });
  byId('summary-text').replaceChildren(...data.summary.map(text => element('li', text)));
  byId('commentary-source').textContent = data.meta.commentarySource === '서버 안내' ? '서버 보정 후 안내' : 'AI 분석';
  byId('perspective-text').textContent = data.additionalPerspective.text;
  byId('perspective-note').textContent = data.additionalPerspective.qualification;
  byId('article-rows').replaceChildren();
  data.articles.forEach(item => {
    const row = element('tr');
    cell(row, item.id); cell(row, item.title, 'title-cell'); cell(row, item.publisher); cell(row, badge(item.frame));
    row.id = `article-${item.id}`;
    row.tabIndex = -1;
    cell(row, item.sentiment); cell(row, item.confidence); cell(row, item.reason, 'reason-cell'); byId('article-rows').append(row);
  });
}

function renderFrameStrip(data) {
  byId('frame-strip').replaceChildren(); byId('frame-legend').replaceChildren();
  FRAMES.forEach((frame, index) => {
    const count = data.distribution.frames[frame] || 0;
    const ratio = data.articles.length ? count / data.articles.length * 100 : 0;
    if (count) {
      const segment = element('div', undefined, `frame-segment frame-${index}`);
      segment.style.width = `${ratio}%`;
      segment.title = `${frame} ${count}건 (${percent(count, data.articles.length)})`;
      segment.setAttribute('aria-label', segment.title); byId('frame-strip').append(segment);
    }
    byId('frame-legend').append(element('span', `${frame} ${percent(count, data.articles.length)}`, `frame-${index}`));
  });
}
let loadingFocus = null;
function setLoadingStep(step, titles = null) {
  document.querySelectorAll('[data-step]').forEach(item => {
    if (Number(item.dataset.step) === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  byId('loading-status').textContent = ['뉴스를 수집하고 있습니다.', '수집한 헤드라인의 프레임을 분석하고 있습니다.', '분석 결과와 근거를 정리하고 있습니다.'][step - 1];
  if (titles !== null || step === 1) renderHeadlineStream(titles || []);
}
function renderHeadlineStream(titles) {
  byId('headline-stream').replaceChildren();
  for (let row = 0; row < 6; row += 1) {
    const line = element('div', undefined, 'stream-row');
    const group = element('div', undefined, 'stream-group');
    const selected = titles.length ? Array.from({ length: Math.min(6, titles.length) }, (_, index) => titles[(row * 3 + index) % titles.length]) : Array(5).fill(null);
    for (const title of selected) group.append(element('span', title || undefined, title ? 'stream-title' : 'stream-placeholder'));
    // 같은 묶음을 두 번 배치해 CSS 이동이 자연스럽게 이어지게 합니다.
    line.append(group, group.cloneNode(true)); byId('headline-stream').append(line);
  }
}
function showLoading(step, titles = []) {
  loadingFocus = document.activeElement;
  setLoadingStep(step, titles);
  byId('loading-screen').hidden = false;
  document.body.classList.add('is-loading');
  byId('search-shell').inert = true; byId('result-scroll').inert = true; byId('section-nav').inert = true;
  byId('loading-screen').focus();
}
function hideLoading() {
  byId('loading-screen').hidden = true;
  document.body.classList.remove('is-loading');
  byId('search-shell').inert = false; byId('result-scroll').inert = false; byId('section-nav').inert = false;
  loadingFocus?.focus(); loadingFocus = null;
}
function updateSectionMode(hasArticles) {
  byId('article-evidence').hidden = !hasArticles;
  for (const id of ['section-distribution', 'section-headlines', 'section-comparison']) byId(id).hidden = !hasArticles;
  byId('section-nav').hidden = !hasArticles;
}
function navigateSection(id) {
  const section = byId(id);
  activateSection(section);
  section.scrollTop = 0;
  section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
function activateSection(section) {
  if (!section.classList.contains('section-active')) section.classList.add('section-active');
}
document.querySelectorAll('[data-go-section]').forEach(button => button.addEventListener('click', () => {
  const target = byId(button.dataset.goSection);
  // 0건 결과 등으로 숨긴 섹션은 건너뜁니다.
  if (target.hidden || (target.closest('#results') && byId('results').hidden)) {
    navigateSection('section-method'); return;
  }
  navigateSection(target.id); target.focus({ preventScroll: true });
}));
function renderSectionInsights(data) {
  const total = data.articles.length;
  const top = Math.max(0, ...Object.values(data.distribution?.frames || {}));
  const leaders = FRAMES.filter(frame => top > 0 && data.distribution.frames[frame] === top);
  const sources = new Set(data.articles.map(article => article.publisher)).size;
  const perspectives = FRAMES.filter(frame => (data.distribution?.frames[frame] || 0) > 0).length;
  const set = (id, copy, insight) => {
    byId(`headline-${id}`).textContent = copy;
    byId(`insight-${id}`).textContent = insight;
  };
  set('briefing', total ? `${total}개의 제목, 지금 읽어야 할 쟁점.` : '잠시, 살펴볼 제목이 부족해요.', total ? `‘${data.keyword}’의 최근 보도를 헤드라인에 드러난 내용만으로 정리했습니다.` : '다른 키워드로 새로운 보도를 찾아보세요.');
  set('distribution', leaders.length === 1 ? `이 표본의 무게중심은 ‘${leaders[0]}’.` : '하나의 이슈, 여러 프레임의 무게.', leaders.length ? `${leaders.join(' · ')} ${top}건 · 전체 ${total}건 기준 ${percent(top, total)}${leaders.length > 1 ? '씩으로 공동 최다입니다.' : '로 가장 많습니다.'} 감성은 제목의 어조를 따로 봅니다.` : '분포를 계산할 기사가 없습니다.');
  set('headlines', `${perspectives}개의 분류로, 같은 이슈 다시 보기.`, '아래 제목을 나란히 읽으며 무엇을 강조했는지 비교해 보세요. 판단 보류는 뚜렷한 프레임을 정하기 어려운 경우입니다.');
  set('comparison', `${sources}개 언론사, 강조점을 비교하다.`, '차이는 이 표본의 건수와 비율로 확인합니다. 언론사의 전체 성향을 뜻하지 않습니다.');
  set('method', '해석보다 먼저, 근거를 확인하세요.', `${total}건의 포함 기사와 ${data.meta.overseasExcludedCount || 0}건의 제외 기사, 분석 기준을 공개합니다. 연구자 도구에서 같은 표본을 직접 검증할 수 있습니다.`);
}
document.querySelectorAll('[data-section]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault(); navigateSection(link.dataset.section); byId(link.dataset.section).focus({ preventScroll: true });
}));
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(item => {
      if (item.isIntersecting) activateSection(item.target);
      else item.target.classList.remove('section-active');
    });
    const entry = entries.filter(item => item.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!entry) return;
    document.querySelectorAll('[data-section]').forEach(link => {
      if (link.dataset.section === entry.target.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }, { root: byId('result-scroll'), threshold: [0.3, 0.6] });
  document.querySelectorAll('.result-section').forEach(section => observer.observe(section));
}
byId('home-link').addEventListener('click', event => {
  event.preventDefault();
  if (isLoading) return;
  document.body.classList.remove('has-results');
  byId('results').hidden = true; byId('section-nav').hidden = true;
  byId('article-evidence').hidden = true; byId('excluded-section').hidden = true;
  window.scrollTo({ top: 0, behavior: 'instant' }); byId('keyword').focus();
});

function formatAnalysisDate(data) {
  const value = data.meta.analyzedAt || data.meta.collectedAt;
  return value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '일시 미확인';
}
function renderBriefing(data) {
  byId('briefing-list').replaceChildren();
  for (const issue of data.briefing || []) {
    const li = element('li'); li.append(element('span', issue.text));
    for (const id of issue.articleIds) {
      const link = element('a', `기사 ${id}`, 'evidence-link');
      link.href = `#article-${id}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        const row = byId(`article-${id}`);
        if (!row) return;
        navigateSection('section-method');
        row.scrollIntoView({ block: 'center', behavior: 'instant' }); row.focus({ preventScroll: true });
      });
      li.append(link);
    }
    byId('briefing-list').append(li);
  }
  byId('briefing-notice').textContent = data.briefingNotice || '';
  byId('analysis-date').textContent = formatAnalysisDate(data);
  const text = buildShareText(data);
  byId('email-link').href = `mailto:?subject=${encodeURIComponent(`프레임 렌즈: ${data.keyword}`)}&body=${encodeURIComponent(text)}`;
}
function buildShareText(data) {
  const max = Math.max(...Object.values(data.distribution.frames));
  const leading = FRAMES.filter(frame => data.distribution.frames[frame] === max).join('·');
  const issues = (data.briefing || []).map((issue, index) => `${index + 1}. ${issue.text} (기사 ${issue.articleIds.join(', ')})`).join('\n');
  const appUrl = new URL(window.location.href); appUrl.hash = ''; appUrl.search = '';
  return `프레임 렌즈 | ${data.keyword}\n분석 일시: ${formatAnalysisDate(data)}\n${issues || data.briefingNotice || '핵심 브리핑 없음'}\n가장 많은 프레임: ${leading}\n헤드라인 기준 요약이며 사실 확인을 대신하지 않습니다.\n${appUrl.href}`;
}
byId('share-button').addEventListener('click', async () => {
  if (isLoading || !currentResult?.articles.length) return;
  const snapshot = currentResult;
  const text = buildShareText(snapshot);
  byId('share-status').textContent = ''; byId('share-fallback').hidden = true;
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: `프레임 렌즈: ${snapshot.keyword}`, text }); }
    catch (error) {
      if (snapshot !== currentResult || error.name === 'AbortError') return;
      byId('share-status').textContent = '공유 창을 열지 못했습니다. 아래 내용을 복사해 주세요.';
      showShareFallback(text);
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (snapshot === currentResult) byId('share-status').textContent = '복사했습니다. 카카오톡이나 메일에 붙여 넣으세요.';
  } catch {
    if (snapshot !== currentResult) return;
    byId('share-status').textContent = '자동 복사가 되지 않았습니다. 아래 내용을 선택해 복사해 주세요.';
    showShareFallback(text);
  }
});
function showShareFallback(text) {
  byId('share-fallback').hidden = false;
  byId('share-text').value = text;
  byId('share-text').focus(); byId('share-text').select();
}

const definitions = ['찬반 충돌이나 집단 간 대립이 중심입니다.', '개인의 사연과 경험으로 공감을 이끌어 냅니다.', '비용·소득·고용 등 경제적 영향이 중심입니다.', '공정·존엄·도덕적 의무 등 가치 판단이 중심입니다.', '문제의 원인이나 해결 책임을 특정 주체에 연결합니다.', '제목만으로 대표 프레임을 정할 근거가 부족합니다.'];
byId('clear-recent').addEventListener('click', () => {
  if (isLoading) return;
  try {
    localStorage.removeItem(RECENT_SEARCH_KEY);
    recentSearches = [];
    byId('recent-status').textContent = '검색 기록을 지웠습니다.';
  } catch {
    byId('recent-status').textContent = '브라우저 저장소의 기록을 지우지 못했습니다. 저장소 접근 설정을 확인해 주세요.';
  }
  renderRecentSearches();
});
renderRecentSearches();
FRAMES.forEach((frame, index) => {
  const item = element('div'); item.append(badge(frame), element('p', definitions[index])); byId('method-list').append(item);
});
document.querySelectorAll('[data-keyword]').forEach(button => button.addEventListener('click', () => {
  if (isLoading) return;
  byId('keyword').value = button.dataset.keyword;
  keywordChanged(); byId('keyword').focus();
}));
byId('search-form').addEventListener('submit', event => { event.preventDefault(); requestAnalysis(false); });
function setBusy(busy) {
  isLoading = busy;
  byId('analyze-button').disabled = busy;
  byId('collect-button').disabled = busy;
  byId('share-button').disabled = busy;
  byId('keyword').disabled = busy;
  byId('publisher-toggle').disabled = busy;
  document.querySelectorAll('[data-keyword]').forEach(b => { b.disabled = busy; });
  document.querySelectorAll('[data-copy]').forEach(b => { b.disabled = busy || !(b.dataset.copy === 'manual' ? collectedResult?.articles.length : researcherResult?.articles.length); });
  byId('reveal-button').disabled = busy || !collectionValid || !collectedResult?.articles.length;
  byId('search-form').setAttribute('aria-busy', String(busy));
  renderRecentSearches();
}
async function readResponse(response) {
  let data;
  try { data = await response.json(); } catch { throw new Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  if (!response.ok || data.ok !== true) throw new Error(data.error?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return data;
}
function showRequestError(error) {
  byId('status').className = 'error';
  byId('status').textContent = error instanceof TypeError ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : error.message;
}
async function collectHeadlines() {
  if (isLoading) return;
  resetCopyUi(); currentResult = null; researcherResult = null; collectedResult = null; collectionValid = false;
  byId('results').hidden = true; byId('ai-results').hidden = true;
  byId('excluded-section').hidden = true; byId('analysis-notice').hidden = true;
  byId('status').className = ''; byId('status').textContent = '';
  const keyword = byId('keyword').value.trim();
  if (!keyword || keyword.length > 100) {
    byId('status').textContent = keyword ? '키워드는 100자까지 입력할 수 있습니다.' : '키워드를 입력해 주세요.';
    byId('status').className = 'error'; byId('keyword').setAttribute('aria-invalid','true'); setBusy(false); return;
  }
  byId('keyword').removeAttribute('aria-invalid'); setBusy(true);
  document.body.classList.add('has-results');
  updateSectionMode(false);
  byId('status').textContent = '최근 뉴스 헤드라인을 수집하고 있습니다...';
  try {
    const data = await readResponse(await fetch('/api/news?q=' + encodeURIComponent(keyword)));
    collectedResult = data; collectionValid = true; showPublishers = false;
    byId('publisher-heading').hidden = true;
    byId('publisher-toggle').textContent = '언론사 보기';
    byId('publisher-toggle').setAttribute('aria-pressed','false');
    renderTitles(data);
    navigateSection('section-method');
    byId('results-title').textContent = '‘' + keyword + '’ 수집된 헤드라인';
    const m = data.meta;
    byId('collection-info').textContent = '받은 ' + m.receivedCount + '건 · 날짜 제외 ' + m.dateExcludedCount + '건 · 형식 제외 ' + (m.invalidExcludedCount || 0) + '건 · 중복 제외 ' + m.duplicateExcludedCount + '건 · 제한 제외 ' + (m.limitExcludedCount || 0) + '건 · 최종 ' + data.articles.length + '건';
    byId('reveal-button').hidden = false;
    byId('status').textContent = data.articles.length ? '수집을 완료했습니다. 먼저 직접 분류한 뒤 AI 분석을 실행하세요.' : '최근 7일간 관련 뉴스를 찾지 못했습니다. 다른 키워드로 시도해 주세요.';
  } catch(error) { showRequestError(error); }
  finally { setBusy(false); }
}
function displayResult(data) {
  currentResult = data;
  document.querySelectorAll('.result-section').forEach(section => { section.classList.remove('section-active'); section.scrollTop = 0; });
  renderSectionInsights(data);
  document.body.classList.add('has-results');
  updateSectionMode(data.articles.length > 0);
  renderScopeNotice(data);
  byId('results').hidden = false; byId('analysis-notice').hidden = false;
  byId('results-title').textContent = '‘' + data.keyword + '’ 분석 결과';
  byId('empty-message').hidden = data.articles.length !== 0;
  const emptyMessage = data.meta.totalAnalyzedCount ? '분석할 국내 기사가 없습니다. 다른 키워드로 시도해 주세요.' : '최근 7일간 관련 뉴스를 찾지 못했습니다. 다른 키워드로 시도해 주세요.';
  byId('empty-message').textContent = emptyMessage;
  byId('small-sample').hidden = data.articles.length === 0 || data.articles.length >= 10;
  byId('ai-results').hidden = false;
  if (data.articles.length) { renderAnalysis(data); renderBriefing(data); }
  else {
    byId('briefing-list').replaceChildren(); byId('frame-strip').replaceChildren(); byId('frame-legend').replaceChildren(); byId('summary-numbers').replaceChildren();
    byId('briefing-notice').textContent = emptyMessage;
    byId('analysis-date').textContent = '';
  }
  byId('share-button').hidden = !data.articles.length;
  byId('email-link').hidden = !data.articles.length;
  navigateSection('section-briefing');
  byId('status').textContent = data.message || emptyMessage;
}
async function requestAnalysis(research = false) {
  if (isLoading) return;
  if (research && (!collectionValid || !collectedResult?.articles.length)) return;
  const keyword = byId('keyword').value.trim();
  if (!keyword || keyword.length > 100) {
    byId('results').hidden = true;
    byId('status').className = 'error';
    byId('status').textContent = keyword ? '키워드는 100자까지 입력할 수 있습니다.' : '키워드를 입력해 주세요.'; return;
  }
  if (research && keyword !== collectedResult.keyword) { keywordChanged(); return; }
  resetCopyUi(); currentResult = null;
  if (research) researcherResult = null;
  byId('results').hidden = true; byId('ai-results').hidden = true;
  byId('excluded-section').hidden = true; byId('analysis-notice').hidden = true;
  byId('share-status').textContent = ''; byId('share-fallback').hidden = true;
  byId('status').className = ''; setBusy(true);
  updateSectionMode(false);
  showLoading(research ? 2 : 1, research ? collectedResult.articles.map(item => item.title) : []);
  byId('status').textContent = research ? '수집된 제목을 분석하고 있습니다... (10~30초 정도 걸립니다)' : '뉴스를 수집하고 제목을 분석하고 있습니다... (10~30초 정도 걸립니다)';
  try {
    const collected = research ? collectedResult : await readResponse(await fetch('/api/news?q=' + encodeURIComponent(keyword)));
    if (!collected.articles.length) {
      displayResult({ ...collected, articles: [], excludedArticles: [], meta: { ...collected.meta, totalAnalyzedCount: 0, overseasExcludedCount: 0, unknownScopeCount: 0 }, message: '최근 7일간 관련 뉴스를 찾지 못했습니다. 다른 키워드로 시도해 주세요.' });
      return;
    }
    setLoadingStep(2, collected.articles.map(item => item.title));
    const payload = {keyword:collected.keyword,articles:collected.articles};
    const data = await readResponse(await fetch('/api/analyze', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
    // 원래 RSS 정리 정보는 수집 응답에서 유지합니다. 분석 메타·번호는 서버 값을 사용합니다.
    data.meta = { ...collected.meta, ...data.meta, receivedCount: collected.meta.receivedCount };
    setLoadingStep(3);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (research) researcherResult = data;
    if (data.articles.length) saveRecentSearch(keyword);
    displayResult(data);
  } catch(error) { showRequestError(error); }
  finally { setBusy(false); hideLoading(); }
}
byId('reveal-button').addEventListener('click', () => requestAnalysis(true));
byId('collect-button').addEventListener('click', collectHeadlines);
byId('publisher-toggle').addEventListener('click', () => {
  if (isLoading || !collectedResult) return;
  showPublishers = !showPublishers;
  byId('publisher-heading').hidden = !showPublishers;
  byId('publisher-toggle').textContent = showPublishers ? '언론사 숨기기' : '언론사 보기';
  byId('publisher-toggle').setAttribute('aria-pressed',String(showPublishers));
  renderTitles(collectedResult);
});
byId('keyword').addEventListener('input', () => {
  keywordChanged();
  if (byId('keyword').value.length >= 100) byId('status').textContent = '키워드는 100자까지 입력할 수 있습니다.';
});
byId('keyword').addEventListener('paste', event => {
  const input = byId('keyword');
  const pasted = event.clipboardData?.getData('text') || '';
  if (input.value.length - (input.selectionEnd - input.selectionStart) + pasted.length > 100) byId('status').textContent = '키워드는 100자까지 입력할 수 있습니다. 넘는 부분은 입력되지 않습니다.';
});
setBusy(false);
