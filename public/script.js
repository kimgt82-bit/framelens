// 모든 기사·언론사·분류는 시제품을 위한 가상 자료입니다.
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

// 나중에는 이 객체를 POST /api/analyze 응답으로 바꿉니다.
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
    cell(row, item.id); cell(row, item.title, 'title-cell'); cell(row, item.publisher);
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
    const card = element('div', undefined, 'representative'); card.append(badge(group.frame));
    const list = element('ul');
    group.articleIds.slice(0, 2).forEach(id => {
      const item = data.articles.find(article => article.id === id);
      if (!item) return;
      const li = element('li'); li.append(element('p', item.title), element('span', `${item.publisher} · `, 'muted'));
      const url = new URL(item.url);
      if (['https:', 'http:'].includes(url.protocol)) {
        const link = element('a', '기사 보기 (예시)'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${item.title} — 기사 보기 (가상 기사의 예시 링크)`); li.append(link);
      }
      list.append(li);
    });
    card.append(list); byId('representatives').append(card);
  });
  byId('summary-text').replaceChildren(...data.summary.map(text => element('li', text)));
  byId('perspective-text').textContent = data.additionalPerspective.text;
  byId('perspective-note').textContent = data.additionalPerspective.qualification;
  byId('article-rows').replaceChildren();
  data.articles.forEach(item => {
    const row = element('tr');
    cell(row, item.id); cell(row, item.title, 'title-cell'); cell(row, item.publisher); cell(row, badge(item.frame));
    cell(row, item.sentiment); cell(row, item.confidence); cell(row, item.reason, 'reason-cell'); byId('article-rows').append(row);
  });
}

const definitions = ['찬반 충돌이나 집단 간 대립이 중심입니다.', '개인의 사연과 경험으로 공감을 이끌어 냅니다.', '비용·소득·고용 등 경제적 영향이 중심입니다.', '공정·존엄·도덕적 의무 등 가치 판단이 중심입니다.', '문제의 원인이나 해결 책임을 특정 주체에 연결합니다.', '제목만으로 대표 프레임을 정할 근거가 부족합니다.'];
FRAMES.forEach((frame, index) => {
  const item = element('div'); item.append(badge(frame), element('p', definitions[index])); byId('method-list').append(item);
});
document.querySelectorAll('[data-keyword]').forEach(button => button.addEventListener('click', () => {
  byId('keyword').value = button.dataset.keyword; byId('keyword').focus();
}));
byId('search-form').addEventListener('submit', event => {
  event.preventDefault();
  const keyword = byId('keyword').value.trim();
  if (!keyword || keyword.length > 100) {
    byId('status').textContent = '키워드를 1~100자로 입력해 주세요.';
    byId('status').className = 'error'; byId('keyword').setAttribute('aria-invalid', 'true'); byId('keyword').focus(); return;
  }
  byId('keyword').removeAttribute('aria-invalid'); byId('status').className = '';
  byId('ai-results').hidden = true; byId('reveal-button').setAttribute('aria-expanded', 'false');
  byId('reveal-button').textContent = 'AI 결과 보기';
  byId('results-title').textContent = `‘${keyword}’ 검색 화면 미리보기`;
  byId('status').textContent = '가상 기사 10건을 표시했습니다. 입력한 키워드와 관계없이 최저임금 예시를 사용합니다.';
  renderTitles(MOCK_RESPONSE); byId('results').hidden = false;
});
byId('reveal-button').addEventListener('click', () => {
  const reveal = byId('ai-results').hidden;
  if (reveal) renderAnalysis(MOCK_RESPONSE);
  byId('ai-results').hidden = !reveal;
  byId('reveal-button').setAttribute('aria-expanded', String(reveal));
  byId('reveal-button').textContent = reveal ? 'AI 결과 접기' : 'AI 결과 보기';
});
