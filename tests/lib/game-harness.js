'use strict';
// 2048의 스크립트를 가짜 DOM과 결정적 난수 위에서 실행한다.
// 실제 타일 위치는 Math.random()이 정하므로, 큐에 넣어둔 값을 순서대로
// 돌려주는 가짜 Math를 넣어 스폰 위치·값을 재현 가능하게 만든다.
const vm = require('node:vm');
const { extractScript } = require('./app');
const { memoryStorage, throwingStorage } = require('./timer-harness');

const EL_IDS = ['score', 'best', 'newGameBtn', 'boardWrap', 'gridBg', 'tileLayer',
                'overlay', 'overlayMsg', 'overlayBtn', 'status'];

function makeEl(tag) {
  return {
    tag, textContent: '', value: '', className: '', hidden: false, type: '',
    dataset: {}, attrs: {}, children: [], style: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    _h: {},
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    fire(t, e) { (this._h[t] || []).forEach(f => f(e || {})); },
    appendChild(c) { this.children.push(c); },
    set innerHTML(v) { if (v === '') this.children = []; },
    get innerHTML() { return ''; },
  };
}

/** values를 순서대로(끝까지 가면 다시 처음부터) 돌려주는 Math.random 대역. */
function makeQueuedRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

function boot({ storage = memoryStorage(), randomQueue = [0] } = {}) {
  const els = {};
  EL_IDS.forEach(id => { els[id] = makeEl('div'); });

  const created = [];
  const docHandlers = {};
  const fakeMath = Object.create(Math);
  fakeMath.random = makeQueuedRandom(randomQueue);

  const sandbox = {
    Math: fakeMath, JSON, Number, String, Object, Array, Set, isFinite, console,
    localStorage: storage,
    document: {
      getElementById: id => els[id],
      createElement: t => { const e = makeEl(t); created.push(e); return e; },
      querySelectorAll: () => [],
      addEventListener(t, f) { (docHandlers[t] = docHandlers[t] || []).push(f); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(extractScript('2048'), sandbox);

  return {
    els, created, sandbox,
    /** 렌더된 타일들. {row, col, value, className}로 요약해서 돌려준다. */
    get tiles() {
      return els.tileLayer.children.map(t => ({
        row: Number(t.style.gridRow),
        col: Number(t.style.gridColumn),
        value: t.dataset.value,
        text: t.textContent,
        className: t.className + (t.classList.contains('spawn') ? ' spawn' : '') + (t.classList.contains('merged') ? ' merged' : ''),
      }));
    },
    get score() { return els.score.textContent; },
    get best() { return els.best.textContent; },
    get overlayShown() { return els.overlay.classList.contains('show'); },
    click(id) { els[id].fire('click'); },
    key(key) {
      (docHandlers.keydown || []).forEach(f => f({ key, preventDefault() {} }));
    },
    swipe(dx, dy) {
      const startX = 100, startY = 100;
      els.boardWrap.fire('touchstart', { touches: [{ clientX: startX, clientY: startY }] });
      els.boardWrap.fire('touchend', { changedTouches: [{ clientX: startX + dx, clientY: startY + dy }] });
    },
  };
}

module.exports = { boot, memoryStorage, throwingStorage, makeQueuedRandom };
