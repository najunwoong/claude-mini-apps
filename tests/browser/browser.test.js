'use strict';
// 실제 Chromium에서 도는 테스트. Node 스텁이 잡지 못하는 것을 잡는다:
// CSS 특이도 회귀, 진짜 이벤트 발생 순서, 캔버스에 실제로 찍힌 픽셀.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { appPath } = require('../lib/app');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  if (process.env.CI) throw new Error('CI에서는 playwright가 설치돼 있어야 합니다: npm i --no-save playwright');
  console.log('playwright가 없어 브라우저 테스트를 건너뜁니다. 설치: npm i --no-save playwright');
  process.exit(0);
}

const fileUrl = name => 'file://' + appPath(name);

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); });

async function open(app, options) {
  const page = await browser.newPage(Object.assign({ viewport: { width: 1200, height: 900 } }, options));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(fileUrl(app));
  page.errors = errors;
  return page;
}

describe('particle-canvas', () => {
  test('색상 스와치가 원형을 유지한다', async () => {
    // .ui button 규칙(특이도 0,1,1)이 .swatch(0,1,0)를 이기면 원이 사각형이 된다.
    const page = await open('particle-canvas');
    const sw = await page.locator('.swatch').first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height),
               radius: getComputedStyle(el).borderRadius };
    });
    assert.strictEqual(sw.tag, 'BUTTON');
    assert.deepStrictEqual([sw.w, sw.h], [22, 22]);
    assert.strictEqual(sw.radius, '50%');
    await page.close();
  });

  test('지우기 버튼은 원래 스타일을 유지한다', async () => {
    const page = await open('particle-canvas');
    const radius = await page.locator('#clearBtn').evaluate(el => getComputedStyle(el).borderRadius);
    assert.strictEqual(radius, '8px');
    await page.close();
  });

  test('키보드만으로 색상을 고를 수 있다', async () => {
    const page = await open('particle-canvas');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    await page.keyboard.press('Enter');
    const pressed = await page.locator('.swatch[aria-pressed="true"]')
      .evaluate(el => el.getAttribute('aria-label'));
    assert.strictEqual(pressed, focused);
    await page.close();
  });

  test('2x 화면에서 버퍼가 CSS 크기의 두 배다', async () => {
    const page = await open('particle-canvas', { deviceScaleFactor: 2 });
    const buf = await page.locator('#c').evaluate(el => ({ w: el.width, css: el.clientWidth }));
    assert.strictEqual(buf.w, buf.css * 2);
    await page.close();
  });

  test('포인터를 움직이면 그 자리에만 그려진다', async () => {
    // 캔버스가 화면 전체를 덮어 mouseenter가 발생하지 않으므로, 직전 위치를
    // 이벤트로 보정할 수 없다. 화면 중앙에서 끌려오는 선이 없어야 한다.
    const page = await open('particle-canvas');
    await page.waitForTimeout(200);
    await page.mouse.move(1100, 820);
    await page.mouse.move(1102, 822);
    await page.waitForTimeout(100);

    const lit = await page.locator('#c').evaluate(el => {
      const g = el.getContext('2d');
      const dpr = el.width / el.clientWidth;
      const count = (x, y, w, h) => {
        const d = g.getImageData(x * dpr, y * dpr, w * dpr, h * dpr).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 60) n++;
        return n;
      };
      return { center: count(500, 350, 200, 200), pointer: count(1040, 760, 150, 130) };
    });
    assert.strictEqual(lit.center, 0, '화면 중앙에 헛선이 그려졌습니다');
    assert.ok(lit.pointer > 0, '포인터 위치에 아무것도 그려지지 않았습니다');
    assert.deepStrictEqual(page.errors, []);
    await page.close();
  });
});

describe('focus-timer', () => {
  test('할 일 체크가 키보드로 토글된다', async () => {
    const page = await open('focus-timer', { viewport: { width: 480, height: 900 } });
    await page.locator('#todoInput').fill('키보드 테스트');
    await page.locator('#addBtn').click();

    const box = await page.locator('.todo-item .check').first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, w: Math.round(r.width), bg: getComputedStyle(el).backgroundColor };
    });
    assert.strictEqual(box.tag, 'BUTTON');
    assert.strictEqual(box.w, 20, '기본 button 스타일이 덮어써졌습니다');
    assert.strictEqual(box.bg, 'rgba(0, 0, 0, 0)');

    await page.locator('.todo-item .check').first().focus();
    await page.keyboard.press('Enter');
    const done = await page.locator('.todo-item').first().evaluate(el => ({
      cls: el.className, pressed: el.querySelector('.check').getAttribute('aria-pressed'),
    }));
    assert.match(done.cls, /done/);
    assert.strictEqual(done.pressed, 'true');
    await page.close();
  });

  test('모드를 바꾸면 시간과 aria-pressed가 함께 바뀐다', async () => {
    const page = await open('focus-timer', { viewport: { width: 480, height: 900 } });
    await page.locator('[data-mode="long"]').click();
    assert.strictEqual(await page.locator('#timeDisplay').textContent(), '15:00');
    assert.strictEqual(await page.locator('[data-mode="long"]').getAttribute('aria-pressed'), 'true');
    assert.strictEqual(await page.locator('[data-mode="focus"]').getAttribute('aria-pressed'), 'false');
    await page.close();
  });

  test('실행 중 모드를 바꾸면 타이머가 멈춘다', async () => {
    const page = await open('focus-timer', { viewport: { width: 480, height: 900 } });
    await page.locator('#startBtn').click();
    await page.locator('[data-mode="short"]').click();
    assert.strictEqual(await page.locator('#startBtn').textContent(), '시작');
    const first = await page.locator('#timeDisplay').textContent();
    await page.waitForTimeout(1200);
    assert.strictEqual(await page.locator('#timeDisplay').textContent(), first, '멈춘 뒤에도 시간이 흘렀습니다');
    await page.close();
  });

  test('세션이 끝나면 alert 없이 인라인 알림이 뜬다', async () => {
    const page = await open('focus-timer', { viewport: { width: 480, height: 900 } });
    let alerted = false;
    page.on('dialog', async d => { alerted = true; await d.dismiss(); });

    assert.ok(await page.locator('#toast').isHidden());
    await page.evaluate(() => { document.querySelector('[data-mode="short"]').dataset.min = '0.03'; });
    await page.locator('[data-mode="short"]').click();
    await page.locator('#startBtn').click();
    await page.waitForTimeout(2800);

    assert.strictEqual(alerted, false, 'alert()가 호출됐습니다');
    assert.ok(await page.locator('#toast').isVisible());
    assert.strictEqual(await page.locator('#toast').textContent(), '휴식 시간이 끝났습니다!');
    assert.strictEqual(await page.locator('#startBtn').textContent(), '시작');
    assert.strictEqual(await page.title(), '포커스 타이머');
    assert.deepStrictEqual(page.errors, []);
    await page.close();
  });
});

describe('2048', () => {
  test('타일 두 개로 시작하고, 방향키로 상태가 바뀐다', async () => {
    const page = await open('2048', { viewport: { width: 480, height: 820 } });
    assert.strictEqual(await page.locator('.tile').count(), 2);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');

    const scoreText = await page.locator('#score').textContent();
    assert.match(scoreText, /^\d+$/);
    const tileCount = await page.locator('.tile').count();
    assert.ok(tileCount >= 2 && tileCount <= 16, `타일 수가 비정상입니다 (${tileCount})`);
    assert.deepStrictEqual(page.errors, []);
    await page.close();
  });

  test('새 게임 버튼을 누르면 점수와 보드가 초기화된다', async () => {
    const page = await open('2048', { viewport: { width: 480, height: 820 } });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');

    await page.locator('#newGameBtn').click();
    assert.strictEqual(await page.locator('#score').textContent(), '0');
    assert.strictEqual(await page.locator('.tile').count(), 2);
    // 오버레이는 페이드 트랜지션 때문에 display:none이 아니라 opacity:0으로 숨는다 —
    // isHidden()은 이를 "보임"으로 판단하므로 opacity를 직접 확인한다.
    const overlayOpacity = await page.locator('#overlay').evaluate(el => getComputedStyle(el).opacity);
    assert.strictEqual(overlayOpacity, '0');
    await page.close();
  });

  test('타일 색이 data-value에 맞게 적용된다 (특이도 회귀)', async () => {
    // 시작 타일은 무작위로 2 또는 4이므로, 어느 쪽이 나오든 맞는 색인지 확인한다.
    const page = await open('2048', { viewport: { width: 480, height: 820 } });
    const EXPECTED = { '2': 'rgb(42, 45, 66)', '4': 'rgb(51, 54, 80)' };
    const { value, bg } = await page.locator('.tile').first().evaluate(el => ({
      value: el.dataset.value,
      bg: getComputedStyle(el).backgroundColor,
    }));
    assert.strictEqual(bg, EXPECTED[value], `data-value=${value} 타일의 배경색이 어긋납니다`);
    await page.close();
  });
});
