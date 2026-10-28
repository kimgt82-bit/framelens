const path = require('node:path');
const express = require('express');

// 비밀 정보는 출력하지 않고 환경변수만 준비합니다.
require('dotenv').config({ quiet: true });

const app = express();
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(3000, () => {
  console.log('프레임 렌즈가 http://localhost:3000 에서 실행 중입니다.');
});
