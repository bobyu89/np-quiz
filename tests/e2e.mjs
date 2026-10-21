// 以真實瀏覽器開啟建置後的 index.html，驗證主要流程。
// 用法：npm test（本機可用 CHROME_PATH 指定 Chromium 執行檔）
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PAGE_URL = 'file://' + fileURLToPath(new URL('../index.html', import.meta.url));
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  ' + detail}`);
  if (!ok) failures++;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

async function open(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...options });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => typeof State !== 'undefined' && State.allQuestions.length > 0);
  return page;
}

// 依年份開始一般練習（取代原本的快速開始）
const startYear = (page, year) => page.evaluate(y => {
  State.mode = 'year'; State.selectedYears = [y]; State.selectedExamTypes = []; State.selectedTags = [];
  State.selectedCount = 30; State.explainMode = 'immediate'; startSession();
}, year);

// ── 題庫完整性 ──
{
  const page = await open();
  const r = await page.evaluate(() => {
    const by = {};
    State.allQuestions.forEach(q => { const k = q.year + q.exam_type; by[k] = (by[k] || 0) + 1; });
    return { n: State.allQuestions.length, exams: Object.keys(by).length, all80: Object.values(by).every(v => v === 80) };
  });
  check('題庫 21 份試卷、每份 80 題', r.exams === 21 && r.all80, JSON.stringify(r));
  check('isCorrect：送分題任何作答皆對、多選任一皆對', await page.evaluate(() =>
    isCorrect('B', '送分') && !isCorrect(null, '送分') && isCorrect('D', 'C、D') && !isCorrect('A', 'C、D')));
  check('載入無 JS 錯誤', page.errors.length === 0, page.errors.join('; '));
  await page.context().close();
}

// ── 一般練習：回顧後前進不能重答（KNOWN_ISSUES #2）、鍵盤、附圖放大 ──
{
  const page = await open({ viewport: { width: 1280, height: 800 }, hasTouch: false });
  await startYear(page, 113);
  const base = await page.evaluate(() => State.progress.totalAnswered);
  for (const k of ['a', 'b']) { await page.keyboard.press(k); await page.waitForTimeout(500); await page.keyboard.press('Enter'); }
  await page.evaluate(() => { prevQuestion(); prevQuestion(); hideExplanation(); nextQuestion(); });
  const locked = await page.evaluate(() => [...document.querySelectorAll('.option-btn')].every(b => b.disabled));
  await page.keyboard.press('c');
  const delta = await page.evaluate(() => State.progress.totalAnswered) - base;
  check('回顧已答題目時選項鎖定、不重複計分', locked && delta === 2, `locked=${locked} delta=${delta}`);

  await page.evaluate(() => { State.sessionQuestions[State.currentIndex] = State.allQuestions.find(q => q.id === 84); renderQuestion(); });
  await page.click('#q-text img');
  const opened = await page.$('.figure-lightbox') !== null;
  await page.keyboard.press('Escape');
  check('附圖可放大並以 Esc 關閉', opened && await page.$('.figure-lightbox') === null);

  await page.evaluate(() => { State.userAnswers = []; confirmEnd(); });
  check('一題都沒答就交卷：回首頁、不留成績紀錄', await page.evaluate(() =>
    document.getElementById('screen-landing').classList.contains('active') && State.progress.sessions.length === 0));
  check('一般練習無 JS 錯誤', page.errors.length === 0, page.errors.join('; '));
  await page.context().close();
}

// ── 模擬考：滑動、題號跳題、重新整理接續、交卷判定 ──
{
  const page = await open();
  await page.evaluate(() => { State.mode = 'exam'; State.examYear = 114; State.examType = '通論'; startSession(); });
  const swipe = dx => page.evaluate(dx => {
    const el = document.querySelector('#q-text');
    const t = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(200)], changedTouches: [t(200)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(200 + dx)] }));
  }, dx);
  for (let i = 0; i < 40; i++) {
    const ans = await page.evaluate(() => State.sessionQuestions[State.currentIndex].answer.split('、')[0]);
    await page.click(`#opt-${ans === '送分' ? 'A' : ans}`);
    await swipe(-150);
  }
  check('模擬考作答不顯示對錯、左滑前進', await page.evaluate(() =>
    State.currentIndex === 40 && State.exam.picks.filter(Boolean).length === 40 && !document.querySelector('.option-btn.correct')));
  await page.reload();
  await page.waitForFunction(() => typeof State !== 'undefined' && State.exam);
  check('重新整理後接續模擬考', await page.evaluate(() => State.exam.picks.filter(Boolean).length === 40 && /^\d+:\d\d$/.test(document.getElementById('timer-num').textContent)));
  await page.click('#exam-nav-btn');
  await page.click('.exam-palette-grid button:nth-child(70)');
  check('題號面板跳題', await page.evaluate(() => State.currentIndex === 69));
  await page.evaluate(() => confirmEnd());
  const verdict = await page.evaluate(() => document.getElementById('exam-verdict').innerText);
  check('交卷計分 50 分並達單科門檻', verdict.includes('50 分') && verdict.includes('達單科 50 分門檻'), verdict);
  await page.click('#session-weak .btn-primary');
  check('從本次弱點一鍵練習 20 題', await page.evaluate(() => State.mode === 'focus' && State.sessionQuestions.length === 20 && !State.exam));
  await page.evaluate(() => {
    State.mode = 'exam'; State.examYear = 114; State.examType = '進階內科'; startSession();
    State.sessionQuestions.forEach((q, i) => { State.exam.picks[i] = q.answer === '送分' ? 'A' : q.answer.split('、')[0]; });
    submitExam();
  });
  const pair = await page.evaluate(() => document.getElementById('exam-verdict').innerText);
  check('搭配同年度另一科判定兩科平均', pair.includes('兩科平均 75 分') && pair.includes('筆試及格'), pair);
  check('模擬考無 JS 錯誤', page.errors.length === 0, page.errors.join('; '));
  await page.context().close();
}

// ── 舊 id 轉換、清除 API Key、筆記 XSS、儲存空間不足 ──
{
  const page = await open();
  await page.evaluate(() => {
    const pr = initProgress();
    pr.srs = { 1500: { level: 2, nextReview: 1 }, 82: { level: 0, nextReview: 0 } };
    localStorage.setItem('np_progress', JSON.stringify(pr));
    localStorage.setItem('np_api_key', 'sk-test');
    localStorage.setItem('np_notes', JSON.stringify({ 1600: { text: '<img src=x onerror="window.__xss=1">筆記' } }));
  });
  await page.reload();
  await page.waitForFunction(() => typeof State !== 'undefined' && State.allQuestions.length > 0);
  check('已移除的題目 id 轉到保留的題目', await page.evaluate(() =>
    State.progress.srs[68]?.level === 2 && !State.progress.srs[1500] && !State.progress.srs[82] && loadNotes()[168]));
  check('清除舊版明文 API Key', await page.evaluate(() => localStorage.getItem('np_api_key') === null));
  await page.evaluate(() => { showScreen('notebook-screen'); renderNotebook(); });
  await page.waitForTimeout(300);
  check('筆記 Markdown 經消毒、不執行 script', await page.evaluate(() => !window.__xss && document.querySelector('.notebook-note-content') !== null));

  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; });
  await startYear(page, 112);
  await page.click('#opt-A');
  await page.waitForTimeout(600);
  check('儲存空間不足時作答流程不中斷', await page.evaluate(() =>
    document.getElementById('explanation-panel').style.display === 'block' && storageWarned));
  check('其他情境無 JS 錯誤', page.errors.length === 0, page.errors.join('; '));
  await page.context().close();
}

// ── 進度備份：匯出後在乾淨的瀏覽器匯入 ──
{
  const page = await open({ acceptDownloads: true });
  await startYear(page, 111);
  for (let i = 0; i < 3; i++) { await page.click('#opt-B'); await page.waitForTimeout(500); await page.evaluate(() => { hideExplanation(); nextQuestion(); }); }
  await page.evaluate(() => { localStorage.setItem('np_notes', JSON.stringify({ 1000: { text: '備份筆記' } })); });
  await page.evaluate(() => showScreen('history-screen'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=匯出進度')]);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'np-')), 'backup.json');
  await download.saveAs(file);
  await page.context().close();

  const fresh = await open();
  await fresh.evaluate(() => showScreen('history-screen'));
  await Promise.all([fresh.waitForEvent('load'), fresh.setInputFiles('#backup-file', file)]);
  await fresh.waitForFunction(() => typeof State !== 'undefined' && State.allQuestions.length > 0);
  check('匯入備份還原作答紀錄與筆記', await fresh.evaluate(() =>
    State.progress.totalAnswered === 3 && loadNotes()[1000]?.text === '備份筆記'));
  const bad = path.join(path.dirname(file), 'bad.json');
  writeFileSync(bad, JSON.stringify({ app: 'other', data: {} }));
  await fresh.evaluate(() => showScreen('history-screen'));
  await fresh.setInputFiles('#backup-file', bad);
  await fresh.waitForTimeout(300);
  check('拒絕非本系統的備份檔', await fresh.evaluate(() => State.progress.totalAnswered === 3));
  check('備份流程無 JS 錯誤', fresh.errors.length === 0, fresh.errors.join('; '));
  await fresh.context().close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} 項測試失敗`);
  process.exit(1);
}
console.log('\n全部測試通過');
