'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { extractScript } = require('./lib/app');

const code = extractScript('particle-canvas');

/** 캔버스 2D 컨텍스트 대역. 드로우콜을 센다. */
function boot({ dpr = 1, width = 1440, height = 900 } = {}) {
  const stats = { fill: 0, beginPath: 0, arc: 0, moveTo: 0, fillStyleSets: 0, transform: null };
  const ctx = {
    _fillStyle: '',
    set fillStyle(v) { stats.fillStyleSets++; this._fillStyle = v; },
    get fillStyle() { return this._fillStyle; },
    globalAlpha: 1,
    fillRect() {}, fill() { stats.fill++; }, beginPath() { stats.beginPath++; },
    arc() { stats.arc++; }, moveTo() { stats.moveTo++; },
    setTransform(...a) { stats.transform = a; },
  };
  const listeners = {};
  const canvas = {
    width: 0, height: 0, style: {}, getContext: () => ctx,
    addEventListener(t, f) { listeners[t] = f; },
  };
  const rafQueue = [];
  const sandbox = {
    Math, Map, Number, Array, console,
    requestAnimationFrame: fn => rafQueue.push(fn),
    window: { innerWidth: width, innerHeight: height, devicePixelRatio: dpr, addEventListener() {} },
    document: {
      getElementById: id => (id === 'c' ? canvas : { addEventListener() {} }),
      querySelectorAll: () => [],
      addEventListener() {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    canvas, ctx, stats,
    fire(type, event) { if (listeners[type]) listeners[type](event || {}); },
    resetStats() { Object.assign(stats, { fill: 0, beginPath: 0, arc: 0, moveTo: 0, fillStyleSets: 0 }); },
    frame() { rafQueue.splice(0).forEach(fn => fn()); },
  };
}

describe('고밀도 화면 대응', () => {
  test('2x 화면에서 버퍼를 두 배로 잡고 CSS 크기는 유지한다', () => {
    const a = boot({ dpr: 2, width: 1440, height: 900 });
    assert.strictEqual(a.canvas.width, 2880);
    assert.strictEqual(a.canvas.height, 1800);
    assert.strictEqual(a.canvas.style.width, '1440px');
    assert.strictEqual(a.canvas.style.height, '900px');
  });

  test('좌표계를 픽셀 밀도만큼 스케일한다', () => {
    const a = boot({ dpr: 2 });
    // canvas.width 대입이 변환을 초기화하므로, 그 뒤에 setTransform이 와야 한다.
    assert.deepStrictEqual(a.stats.transform, [2, 0, 0, 2, 0, 0]);
  });

  test('1x 화면에서는 버퍼 크기가 그대로다', () => {
    const a = boot({ dpr: 1, width: 1440, height: 900 });
    assert.strictEqual(a.canvas.width, 1440);
  });

  test('과도한 픽셀 밀도는 2배로 제한한다', () => {
    const a = boot({ dpr: 4, width: 1440, height: 900 });
    assert.strictEqual(a.canvas.width, 2880, '고배율 화면에서 버퍼가 너무 커집니다');
  });
});

describe('렌더링 배칭', () => {
  function draw() {
    const a = boot({ dpr: 2 });
    a.fire('mousedown', { clientX: 100, clientY: 300 });
    for (let i = 0; i < 40; i++) {
      a.fire('mousemove', { clientX: 100 + i * 9, clientY: 300 + (i % 7) * 11 });
    }
    a.resetStats();
    a.frame();
    return a.stats;
  }

  test('파티클 수보다 훨씬 적은 횟수로 채운다', () => {
    const s = draw();
    assert.ok(s.arc > 100, `파티클이 충분히 생성되지 않았습니다 (${s.arc}개)`);
    assert.ok(s.fill < s.arc / 10, `fill ${s.fill}회 / 원 ${s.arc}개 — 배칭이 동작하지 않습니다`);
  });

  test('원마다 moveTo가 붙어 경로가 선으로 이어지지 않는다', () => {
    const s = draw();
    assert.strictEqual(s.moveTo, s.arc);
  });
});

describe('포인터 추적', () => {
  // 캔버스가 화면 전체를 덮어 포인터가 경계를 넘지 않으므로 mouseenter가 발생하지 않는다.
  // 직전 위치를 모르는 상태에서 보간하면 화면을 가로지르는 엉뚱한 선이 생긴다.
  test('첫 이동에서는 보간하지 않는다', () => {
    const a = boot({ width: 1200, height: 900 });
    a.fire('mousemove', { clientX: 1100, clientY: 820 });
    a.frame();
    assert.ok(a.stats.arc <= 2, `첫 이동에 원이 ${a.stats.arc}개 생겼습니다 (헛선)`);
  });

  test('연속 이동은 정상적으로 보간한다', () => {
    const a = boot({ width: 1200, height: 900 });
    a.fire('mousemove', { clientX: 400, clientY: 400 });
    a.resetStats();
    a.fire('mousemove', { clientX: 460, clientY: 400 });   // 60px 이동
    a.frame();
    assert.ok(a.stats.arc > 2, '이동 경로가 채워지지 않았습니다');
  });

  test('창을 벗어나면 기준 위치를 버린다', () => {
    const a = boot({ width: 1200, height: 900 });
    a.fire('mousemove', { clientX: 100, clientY: 100 });
    a.fire('mouseleave', {});
    a.resetStats();
    a.fire('mousemove', { clientX: 1100, clientY: 800 });  // 멀리 떨어진 곳에서 재진입
    a.frame();
    assert.ok(a.stats.arc <= 2, `재진입 시 원이 ${a.stats.arc}개 생겼습니다 (헛선)`);
  });
});

describe('죽은 코드', () => {
  test('쓰이지 않는 포인터 상태가 없다', () => {
    assert.ok(!/mouse\.down/.test(code));
    assert.ok(!/mouse\.[xy]\b/.test(code));
  });

  test('값만 계산하고 버리는 인터벌이 없다', () => {
    assert.ok(!/setInterval/.test(code));
  });
});
