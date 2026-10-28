const path = require('node:path');
const express = require('express');
const Parser = require('rss-parser');

// 비밀 정보는 출력하지 않고 환경변수만 준비합니다.
require('dotenv').config({ quiet: true });

const app = express();
const parser = new Parser({ customFields: { item: [['source', 'publisherSource']] } });
const koreanDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function apiError(status, code, message, retryable) {
  return Object.assign(new Error(message), { status, code, retryable });
}

function validateKeyword(value) {
  if (typeof value !== 'string') {
    throw apiError(400, '입력_오류', '키워드를 1~100자로 입력해 주세요.', false);
  }
  const keyword = value.trim();
  if (keyword.length < 1 || keyword.length > 100) {
    throw apiError(400, '입력_오류', '키워드를 1~100자로 입력해 주세요.', false);
  }
  // 잘못된 유니코드도 URL 생성 단계의 내부 오류 대신 입력 오류로 안내합니다.
  try { encodeURIComponent(keyword); } catch {
    throw apiError(400, '입력_오류', '키워드의 문자를 확인해 주세요.', false);
  }
  return keyword;
}

async function fetchRssXml(keyword) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}+when:7d&hl=ko&gl=KR&ceid=KR:ko`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrameLens/0.1)', Accept: 'application/rss+xml, application/xml, text/xml' }
    });
    if (!response.ok) {
      throw apiError(502, '뉴스_수집_실패', '뉴스를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
    }
    return await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      throw apiError(504, '뉴스_요청_시간_초과', '뉴스 요청이 10초를 초과했습니다. 잠시 후 다시 시도해 주세요.', true);
    }
    if (error.status) throw error;
    throw apiError(502, '뉴스_수집_실패', '뉴스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
  } finally {
    clearTimeout(timer);
  }
}

function extractPublisher(source) {
  const text = typeof source === 'string' ? source : source?._;
  return typeof text === 'string' && text.trim() ? text.trim() : '언론사 미상';
}

function formatKoreanDate(date) {
  return koreanDateFormatter.format(date);
}

function normalizeArticle(item) {
  const publisher = extractPublisher(item.publisherSource);
  const originalTitle = typeof item.title === 'string' ? item.title : '';
  const trimmedTitle = originalTitle.trim();
  const suffix = ` - ${publisher}`;
  const title = publisher !== '언론사 미상' && trimmedTitle.endsWith(suffix)
    ? trimmedTitle.slice(0, -suffix.length).trim() : trimmedTitle;
  const timestamp = typeof item.pubDate === 'string' && item.pubDate.trim()
    ? Date.parse(item.pubDate) : NaN;
  return { title, originalTitle, publisher, timestamp, url: typeof item.link === 'string' ? item.link.trim() : '' };
}

async function collectNews(value) {
  const keyword = validateKeyword(value);
  const requestedAt = new Date();
  const latest = requestedAt.getTime();
  const earliest = latest - 7 * 24 * 60 * 60 * 1000;
  const xml = await fetchRssXml(keyword);
  let feed;
  try {
    feed = await parser.parseString(xml);
    if (!Array.isArray(feed.items)) throw new Error('기사 목록 형식 오류');
  } catch {
    throw apiError(502, '뉴스_해석_실패', '뉴스 형식을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
  }
  let dateExcludedCount = 0;
  let invalidExcludedCount = 0;
  const candidates = [];
  for (const item of feed.items) {
    const article = normalizeArticle(item);
    if (!Number.isFinite(article.timestamp) || article.timestamp < earliest || article.timestamp > latest) {
      dateExcludedCount += 1;
      continue;
    }
    let validLink = false;
    try { validLink = ['http:', 'https:'].includes(new URL(article.url).protocol); } catch { /* 잘못된 링크는 제외합니다. */ }
    if (!article.title || !validLink) {
      invalidExcludedCount += 1;
      continue;
    }
    candidates.push(article);
  }
  candidates.sort((a, b) => b.timestamp - a.timestamp);
  const links = new Set();
  const titles = new Set();
  let duplicateExcludedCount = 0;
  const unique = candidates.filter(article => {
    const key = JSON.stringify([article.publisher, article.title]);
    // 제외한 항목의 키도 기억하여 연결된 중복이 다시 남지 않게 합니다.
    const duplicate = links.has(article.url) || titles.has(key);
    links.add(article.url); titles.add(key);
    if (duplicate) duplicateExcludedCount += 1;
    return !duplicate;
  });
  const articles = unique.slice(0, 30).map((article, index) => ({
    id: index + 1, title: article.title, originalTitle: article.originalTitle,
    publisher: article.publisher, publishedAt: new Date(article.timestamp).toISOString(),
    publishedAtKorean: formatKoreanDate(new Date(article.timestamp)), url: article.url
  }));
  const warnings = [];
  if (dateExcludedCount) warnings.push(`날짜를 확인할 수 없거나 최근 7일 범위 밖인 ${dateExcludedCount}건을 제외했습니다.`);
  if (invalidExcludedCount) warnings.push(`제목 또는 유효한 기사 링크가 없는 ${invalidExcludedCount}건을 제외했습니다.`);
  if (articles.some(article => article.publisher === '언론사 미상')) warnings.push('언론사를 확인하지 못한 기사가 있습니다.');
  return {
    ok: true, keyword,
    meta: {
      collectedAt: requestedAt.toISOString(), collectedAtKorean: formatKoreanDate(requestedAt),
      timeZone: 'Asia/Seoul', periodDays: 7, maxArticles: 30,
      receivedCount: feed.items.length, dateExcludedCount, invalidExcludedCount,
      duplicateExcludedCount, limitExcludedCount: Math.max(0, unique.length - 30), articleCount: articles.length
    },
    articles,
    message: articles.length ? `최근 7일 기사 ${articles.length}건을 가져왔습니다.` : '최근 7일 조건에 맞는 기사가 없습니다. 다른 키워드를 입력해 주세요.',
    warnings
  };
}

function sendApiError(res, error) {
  const known = [400, 502, 504].includes(error.status);
  res.status(known ? error.status : 500).json({
    ok: false,
    error: {
      code: known ? error.code : '서버_오류',
      message: known ? error.message : '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      retryable: known ? error.retryable : true
    }
  });
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/news', async (req, res) => {
  // 줄바꿈과 제어 문자가 터미널 로그 형식을 바꾸지 않도록 정리합니다.
  const logKeyword = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100).replace(/[\u0000-\u001f\u007f]/g, ' ') : '(입력 없음 또는 형식 오류)';
  try {
    const result = await collectNews(req.query.q);
    const meta = result.meta;
    console.log(`[뉴스 수집] 키워드=${logKeyword} 원래=${meta.receivedCount} 날짜제외=${meta.dateExcludedCount} 형식제외=${meta.invalidExcludedCount} 중복제외=${meta.duplicateExcludedCount} 제한제외=${meta.limitExcludedCount} 최종=${meta.articleCount}`);
    res.json(result);
  } catch (error) {
    console.error(`[뉴스 오류] 키워드=${logKeyword} ${error.code || '서버_오류'}: ${error.status ? error.message : '내부 처리 실패'}`);
    sendApiError(res, error);
  }
});
app.use(express.static(path.join(__dirname, 'public')));

app.listen(3000, () => {
  console.log('프레임 렌즈가 http://localhost:3000 에서 실행 중입니다.');
});
