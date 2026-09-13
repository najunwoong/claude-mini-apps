'use strict';
// focus-timer의 스크립트를 가짜 시계·가짜 DOM 위에서 실행한다.
// 시간을 우리가 통제하므로 25분 세션을 즉시 검증할 수 있고,
// 백그라운드 탭 스로틀링(인터벌이 늦게 도는 상황)도 그대로 재현할 수 있다.
const vm = require('node:vm');
const { extractScript } = require('./app');

const EL_IDS = ['timeDisplay', 'sessionLabel', 'startBtn', 'resetBtn', 'pomodoroCount',
                'pomodoroLabel', 'toast', 'todoInput', 'addBtn', 'todoList'];

function makeEl(tag) {
  return {
    tag, textContent: '', value: '', className: '', hidden: false, type: '',
    dataset: {}, attrs: {}, children: [],
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

/** 메모리 기반 localStorage 대역. entries로 초기값을 준다. */
function memoryStorage(entries) {
  const m = new Map(entries || []);
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    raw: m,
  };
}

/** 접근할 때마다 예외를 던지는 저장소 (사파리 프라이빗 모드 등) */
const throwingStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
};

function boot({ storage = memoryStorage(), startMs = Date.parse('2026-09-13T09:00:00Z') } = {}) {
  let now = startMs;
  const els = {};
  EL_IDS.forEach(id => { els[id] = makeEl('div'); });

  const intervals = [];
  const timeouts = [];
  const created = [];
  let audioContexts = 0;

  class FakeAudioContext {
    constructor() { audioContexts++; this.state = 'running'; this.currentTime = 0; }
    createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    get destination() { return {}; }
    resume() { this.state = 'running'; }
  }

  const RealDate = Date;
  function FakeDate(...args) { return args.length ? new RealDate(...args) : new RealDate(now); }
  FakeDate.now = () => now;
  FakeDate.parse = RealDate.parse;
  FakeDate.prototype = RealDate.prototype;

  const sandbox = {
    Date: FakeDate, Math, JSON, Number, String, Object, Array, parseInt, parseFloat, isFinite, console,
    setInterval: (fn, ms) => intervals.push({ fn, ms }),
    clearInterval: id => { if (id) intervals[id - 1] = null; },
    setTimeout: (fn, ms) => timeouts.push({ fn, at: now + ms }),
    clearTimeout: id => { if (id) timeouts[id - 1] = null; },
    localStorage: storage,
    window: { AudioContext: FakeAudioContext },
    document: {
      title: '', hidden: false,
      getElementById: id => els[id],
      querySelectorAll: () => [],
      createElement: t => { const e = makeEl(t); created.push(e); return e; },
      addEventListener() {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(extractScript('focus-timer'), sandbox);

  return {
    els, created, sandbox,
    get audioContexts() { return audioContexts; },
    get title() { return sandbox.document.title; },
    get display() { return els.timeDisplay.textContent; },
    click(id) { els[id].fire('click'); },
    /** stepMs 간격으로 콜백을 돌리며 totalMs만큼 가상 시간을 흘려보낸다. */
    advance(totalMs, stepMs) {
      for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
        now += stepMs;
        intervals.forEach(t => t && t.fn());
        timeouts.forEach((t, i) => { if (t && now >= t.at) { timeouts[i] = null; t.fn(); } });
      }
    },
  };
}

module.exports = { boot, memoryStorage, throwingStorage };
