// 畫面比對：在固定狀態下截下各畫面，與基準截圖逐像素比較。用於重構或調整樣式後確認畫面沒有非預期的改變。
//   node tests/visual.mjs --update     產生基準截圖（改動前執行）
//   node tests/visual.mjs              與基準比較，列出有差異的畫面（差異圖存在 .visual/diff/）
// 需要 ImageMagick（compare）；本機可用 CHROME_PATH 指定 Chromium。
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE_URL = 'file://' + path.join(ROOT, 'index.html');
const DIR = path.join(ROOT, '.visual');
const UPDATE = process.argv.includes('--update');
const OUT = path.join(DIR, UPDATE ? 'baseline' : 'current');
mkdirSync(OUT, { recursive: true });

const FIXED_TIME = new Date('2026-10-20T09:00:00+08:00');
const NOISE_PIXELS = 50;

// 固定亂數（mulberry32）、關閉動畫，讓每次截圖一致
const STABILIZE = `
  (() => {
    let a = 20261020;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const css = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#starfield{display:none!important}';
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
      if (window.Chart) Chart.defaults.animation = false;
    });
  })();`;

// 固定的作答紀錄，讓成績、紀錄、成就畫面有內容
const SEED_STORAGE = `
  (() => {
    if (localStorage.getItem('np_visual_seeded')) return;
    const ts = ${FIXED_TIME.getTime()};
    localStorage.setItem('np_progress', JSON.stringify({
      totalAnswered: 120, totalCorrect: 84,
      byTag: { 心臟血管: { correct: 10, total: 20 }, 呼吸系統: { correct: 15, total: 18 }, 法規倫理: { correct: 6, total: 12 } },
      byYear: { 114: { correct: 40, total: 60 }, 115: { correct: 44, total: 60 } },
      firstCorrect: {}, lastAnswered: { 2038: { correct: false, count: 1 } }, srs: { 2038: { level: 0, nextReview: 0 } },
      sessions: [70, 62, 81].map((pct, i) => ({ date: '2026/10/' + (17 + i), ts: ts - i * 86400000, total: 40, correct: Math.round(pct * 0.4), pct,
        mode: ['year', 'exam', 'focus'][i], duration: 1500, tagPct: { 心臟血管: pct - 10, 呼吸系統: pct } })),
      mockExams: [{ year: 115, examType: '通論', score: 72.5, ts }],
    }));
    localStorage.setItem('np_achievements', JSON.stringify({ first_correct: { date: '2026-10-01T00:00:00Z' }, streak_5: { date: '2026-10-02T00:00:00Z' } }));
    localStorage.setItem('np_notes', JSON.stringify({ 2038: { text: '**穿孔**：站立 KUB 看橫膈下游離氣體\\n- NPO + IV PPI', qid: 2038, ts, year: 115, tags: ['消化系統'], question: '病人主訴便祕 3 天…' } }));
    localStorage.setItem('np_visual_seeded', '1');
  })();`;

const VIEWPORTS = { m: { width: 390, height: 844 }, d: { width: 1280, height: 800 } };

// 每個畫面：名稱 → 在頁面中執行的準備步驟
const SCENES = {
  landing: async () => {},
  mode: async p => p.evaluate(() => { showScreen('mode'); initModeScreen(); }),
  'mode-exam': async p => p.evaluate(() => { showScreen('mode'); initModeScreen(); selectMode(document.querySelector('.mode-card[data-mode="exam"]'), 'exam'); }),
  quiz: async p => startWith(p, [2038, 1919, 2001]),
  'quiz-combo': async p => startWith(p, [70, 2038]),
  'quiz-answered': async p => { await startWith(p, [2038, 1919]); await p.evaluate(() => selectAnswer('C')); await p.waitForTimeout(600); },
  'quiz-wrong': async p => { await startWith(p, [1919, 2038]); await p.evaluate(() => selectAnswer('B')); await p.waitForTimeout(600); },
  result: async p => { await finishSession(p); },
  'result-explanations': async p => { await finishSession(p); await p.evaluate(() => switchResultTab('explanations')); },
  handout: async p => { await finishSession(p); await p.evaluate(() => generateHandout()); },
  'exam-palette': async p => {
    await p.evaluate(() => { State.mode = 'exam'; State.examYear = 115; State.examType = '通論'; startSession();
      State.exam.deadline = Date.now() + 90 * 60000; State.exam.picks[0] = 'A'; State.exam.picks[3] = 'C'; renderQuestion(); openExamPalette(); });
  },
  'exam-result': async p => {
    await p.evaluate(() => { State.mode = 'exam'; State.examYear = 115; State.examType = '進階內科'; startSession();
      State.sessionQuestions.forEach((q, i) => { if (i < 60) State.exam.picks[i] = q.answer === '送分' ? 'A' : q.answer.split('、')[0]; }); submitExam(); });
  },
  topics: async p => p.evaluate(() => { showScreen('topics'); renderTopicsOverview(); }),
  'topics-detail': async p => {
    await p.evaluate(() => { showScreen('topics'); renderTopicsOverview(); showTopicDetail('心臟血管');
      document.querySelector('#topics-detail-container details').open = true; });
  },
  history: async p => p.evaluate(() => showScreen('history-screen')),
  achievements: async p => p.evaluate(() => showScreen('achievements-screen')),
  notebook: async p => p.evaluate(() => { showScreen('notebook-screen'); renderNotebook(); }),
  lightbox: async p => { await startWith(p, [84]); await p.click('#q-text img'); },
};

// 主題：每套主題在手機尺寸拍幾個代表畫面（抽出 inline style 後，主題規則的優先順序可能改變）
const THEMES = ['theme-forest', 'theme-white', 'theme-nightnurse', 'theme-neon', 'theme-wagashi', 'theme-abyss'];
const THEMED = ['landing', 'mode', 'quiz-answered', 'result', 'topics-detail', 'history', 'notebook'];
for (const theme of THEMES) {
  for (const name of THEMED) {
    SCENES[`${theme}-${name}`] = { mobileOnly: true, run: async p => { await p.evaluate(t => setTheme(t), theme); await SCENES[name](p); } };
  }
}

async function startWith(page, ids) {
  await page.evaluate(ids => {
    State.mode = 'year'; State.explainMode = 'immediate';
    const qs = ids.map(id => State.allQuestions.find(q => q.id === id));
    beginSession(qs);
  }, ids);
}

async function finishSession(page) {
  await startWith(page, [2038, 1919, 2001, 2002, 2003, 70]);
  for (const [i, letter] of ['C', 'B', 'A', 'A', 'D', 'C'].entries()) {
    await page.evaluate(([i, l]) => { State.currentIndex = i; renderQuestion(); selectAnswer(l); hideExplanation(); }, [i, letter]);
  }
  await page.evaluate(() => endSession());
  await page.waitForTimeout(300);
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const errors = [];
for (const [vp, viewport] of Object.entries(VIEWPORTS)) {
  for (const [name, scene] of Object.entries(SCENES)) {
    if (scene.mobileOnly && vp !== 'm') continue;
    const prepare = scene.run || scene;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: vp === 'm' });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(FIXED_TIME);
    await page.addInitScript(STABILIZE);
    await page.addInitScript(SEED_STORAGE);
    page.on('pageerror', e => errors.push(`${vp}/${name}: ${e.message}`));
    page.on('dialog', d => d.accept());
    await page.goto(PAGE_URL);
    await page.waitForFunction(() => typeof State !== 'undefined' && State.allQuestions.length > 0);
    await prepare(page);
    // 詳解面板會平滑捲動、圖表尺寸由 ResizeObserver 決定：等畫面穩定並捲回頂端再截圖
    await page.waitForTimeout(700);
    await page.evaluate(() => document.fonts.ready);
    // 不用 fullPage：截圖時暫時改變視窗大小會讓圖表重算尺寸。先把視窗撐到整頁高度，等版面穩定再截
    let height = 0;
    for (let i = 0; i < 5; i++) {
      const h = await page.evaluate(() => { window.scrollTo(0, 0); return document.documentElement.scrollHeight; });
      if (h === height) break;
      height = h;
      await page.setViewportSize({ width: viewport.width, height });
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(OUT, `${vp}-${name}.png`) });
    await ctx.close();
  }
}
await browser.close();
if (errors.length) console.log('JS 錯誤：\n' + errors.join('\n'));

if (UPDATE) {
  console.log(`已更新基準截圖：${readdirSync(OUT).length} 張（.visual/baseline/）`);
  process.exit(errors.length ? 1 : 0);
}

const base = path.join(DIR, 'baseline');
const diffDir = path.join(DIR, 'diff');
mkdirSync(diffDir, { recursive: true });
let changed = 0;
for (const file of readdirSync(OUT).sort()) {
  const ref = path.join(base, file);
  if (!existsSync(ref)) { console.log(`？ ${file}：沒有基準截圖`); changed++; continue; }
  let pixels;
  try {
    execFileSync('compare', ['-metric', 'AE', '-fuzz', '1%', ref, path.join(OUT, file), path.join(diffDir, file)], { stdio: 'pipe' });
    pixels = 0;
  } catch (e) {
    const out = (e.stderr || '').toString().trim();
    pixels = /^\d+(\.\d+)?/.test(out) ? Number(out.split(' ')[0]) : NaN;
    if (Number.isNaN(pixels)) pixels = `尺寸不同或無法比較（${out.slice(0, 80)}）`;
  }
  // 50 像素以下多為文字反鋸齒的隨機差異；一條 1px 邊框的改變就會超過這個數字
  if (typeof pixels === 'number' && pixels <= NOISE_PIXELS) { if (pixels) console.log(`≈ ${file}：${pixels} 像素（雜訊）`); }
  else { console.log(`✗ ${file}：${pixels} 像素不同`); changed++; }
}
console.log(changed ? `\n${changed} 個畫面有差異（差異圖：.visual/diff/）` : '\n所有畫面與基準一致');
process.exit(changed || errors.length ? 1 : 0);
