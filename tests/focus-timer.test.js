'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { boot, memoryStorage, throwingStorage } = require('./lib/timer-harness');

const MIN = 60 * 1000;

describe('카운트다운 정확도', () => {
  test('포그라운드에서 25분 세션이 25분에 끝난다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(25 * MIN, 250);
    assert.strictEqual(a.display, '00:00');
  });

  // 브라우저는 비활성 탭의 타이머를 최대 1분 간격까지 늦춘다.
  // 남은 초를 직접 세면 세션이 실제보다 훨씬 늦게 끝나므로, 종료 시각 기준으로 계산해야 한다.
  test('인터벌이 60초 간격으로 늦어져도 25분에 끝난다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(25 * MIN, 60 * 1000);
    assert.strictEqual(a.display, '00:00');
  });

  test('탭이 완전히 멈췄다가 깨어나도 경과 시간이 반영된다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(25 * MIN, 25 * MIN);   // 콜백이 딱 한 번만 도는 극단적인 경우
    assert.strictEqual(a.display, '00:00');
  });
});

describe('일시정지와 리셋', () => {
  test('일시정지하면 남은 시간이 보존된다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(10 * 1000, 250);
    assert.strictEqual(a.display, '24:50');

    a.click('startBtn');                 // 일시정지
    a.advance(10 * MIN, 250);            // 멈춘 채로 10분 방치
    assert.strictEqual(a.display, '24:50', '정지 중에 시간이 흘렀습니다');
  });

  test('재개하면 남은 시간부터 이어진다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(10 * 1000, 250);
    a.click('startBtn');
    a.advance(10 * MIN, 250);
    a.click('startBtn');                 // 재개
    a.advance(10 * 1000, 250);
    assert.strictEqual(a.display, '24:40');
  });

  test('리셋하면 처음으로 돌아가고 다시 흐르지 않는다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(30 * 1000, 250);
    a.click('resetBtn');
    a.advance(1 * MIN, 250);
    assert.strictEqual(a.display, '25:00');
  });
});

describe('저장소 장애 내성', () => {
  // 프라이빗 모드·사이트 데이터 차단 환경에서는 localStorage 접근 자체가 예외를 던진다.
  test('localStorage가 예외를 던져도 앱이 뜬다', () => {
    const a = boot({ storage: throwingStorage });
    assert.strictEqual(a.display, '25:00');
  });

  test('저장값이 손상돼도 앱이 뜬다', () => {
    const a = boot({ storage: memoryStorage([['ft_todos', '{망가진 값'], ['ft_pomodoros', 'abc']]) });
    assert.strictEqual(a.display, '25:00');
  });

  test('할 일 목록이 배열이 아니어도 앱이 뜬다', () => {
    const a = boot({ storage: memoryStorage([['ft_todos', '"문자열"']]) });
    assert.strictEqual(a.display, '25:00');
  });
});

describe('뽀모도로 기록', () => {
  const DAY1 = Date.parse('2026-09-13T09:00:00Z');

  test('집중 세션을 마치면 오늘 기록이 늘어난다', () => {
    const a = boot({ startMs: DAY1 });
    a.click('startBtn');
    a.advance(25 * MIN + 1000, 1000);
    assert.strictEqual(a.els.pomodoroLabel.textContent, '오늘 1회 완료');
  });

  test('같은 날 다시 열면 기록이 유지된다', () => {
    const storage = memoryStorage();
    const a = boot({ storage, startMs: DAY1 });
    a.click('startBtn');
    a.advance(25 * MIN + 1000, 1000);

    const b = boot({ storage, startMs: DAY1 + 3 * 3600 * 1000 });
    assert.strictEqual(b.els.pomodoroLabel.textContent, '오늘 1회 완료');
  });

  test('날짜가 바뀌면 0부터 다시 센다', () => {
    const storage = memoryStorage();
    const a = boot({ storage, startMs: DAY1 });
    a.click('startBtn');
    a.advance(25 * MIN + 1000, 1000);

    const b = boot({ storage, startMs: DAY1 + 2 * 24 * 3600 * 1000 });
    assert.strictEqual(b.els.pomodoroLabel.textContent, '');
  });

  test('이전 버전이 저장한 숫자 기록을 이어받는다', () => {
    const a = boot({ storage: memoryStorage([['ft_pomodoros', '3']]) });
    assert.strictEqual(a.els.pomodoroLabel.textContent, '오늘 3회 완료');
  });

  test('8회를 넘겨도 점은 8개까지만, 초과분은 라벨로 표시한다', () => {
    const stored = JSON.stringify({ date: '2026-09-13', count: 12 });
    const a = boot({ storage: memoryStorage([['ft_pomodoros', stored]]), startMs: DAY1 });
    const filled = a.els.pomodoroCount.children.filter(d => d.className.includes('filled'));
    assert.strictEqual(filled.length, 8);
    assert.strictEqual(a.els.pomodoroLabel.textContent, '오늘 12회 완료');
  });
});

describe('세션 종료 알림', () => {
  test('시작 시에는 알림이 숨겨져 있다', () => {
    const a = boot();
    a.click('startBtn');
    assert.strictEqual(a.els.toast.hidden, true);
  });

  test('종료되면 alert 대신 인라인 알림이 뜬다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(25 * MIN + 1000, 1000);
    assert.strictEqual(a.els.toast.hidden, false);
    assert.strictEqual(a.els.toast.textContent, '집중 시간이 끝났습니다!');
  });

  test('알림은 잠시 뒤 스스로 사라진다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(25 * MIN + 1000, 1000);
    a.advance(9 * 1000, 1000);
    assert.strictEqual(a.els.toast.hidden, true);
  });
});

describe('알림음', () => {
  // 브라우저는 동시에 열 수 있는 AudioContext 수를 제한한다.
  // 세션마다 새로 만들면 몇 번 만에 소리가 조용히 나지 않게 된다.
  test('세션을 여러 번 완료해도 AudioContext는 하나만 만든다', () => {
    const a = boot();
    for (let i = 0; i < 5; i++) {
      a.click('startBtn');
      a.advance(25 * MIN + 1000, 1000);
    }
    assert.strictEqual(a.audioContexts, 1);
  });
});

describe('탭 제목', () => {
  test('실행 중에는 남은 시간을 보여준다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(5 * 1000, 250);
    assert.match(a.title, /^\d\d:\d\d · 포커스 타이머$/);
  });

  test('멈추면 원래 제목으로 돌아온다', () => {
    const a = boot();
    a.click('startBtn');
    a.advance(5 * 1000, 250);
    a.click('resetBtn');
    assert.strictEqual(a.title, '포커스 타이머');
  });
});

describe('할 일 목록 접근성', () => {
  test('체크와 삭제가 키보드로 조작 가능한 button이다', () => {
    const storage = memoryStorage([['ft_todos', JSON.stringify([{ text: '테스트 항목', done: false }])]]);
    const a = boot({ storage });
    const buttons = a.created.filter(e => e.tag === 'button');
    const check = buttons.find(e => e.className === 'check');
    const del = buttons.find(e => e.className === 'del');

    assert.ok(check, '체크가 button이 아닙니다');
    assert.strictEqual(check.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(check.getAttribute('aria-label'), '테스트 항목 완료 표시');
    assert.ok(del, '삭제가 button이 아닙니다');
    assert.strictEqual(del.getAttribute('aria-label'), '테스트 항목 삭제');
  });
});
