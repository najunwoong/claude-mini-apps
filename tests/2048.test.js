'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { boot, memoryStorage, throwingStorage } = require('./lib/game-harness');

function findTile(tiles, row, col) {
  return tiles.find(t => t.row === row && t.col === col);
}

describe('새 게임', () => {
  test('시작하면 타일 2개가 생기고 점수는 0이다', () => {
    // 큐가 전부 0이면: 위치 선택은 항상 "행 우선으로 첫 번째 빈 칸",
    // 값 선택은 항상 2(0 < 0.9)가 된다. 첫 스폰은 (0,0), 그 칸이 찬 뒤
    // 두 번째 스폰은 다음 빈 칸인 (0,1)에 놓인다.
    const a = boot({ randomQueue: [0] });
    assert.strictEqual(a.score, '0');
    assert.strictEqual(a.tiles.length, 2);
    assert.deepStrictEqual(findTile(a.tiles, 1, 1), { row: 1, col: 1, value: '2', text: '2', className: 'tile spawn' });
    assert.deepStrictEqual(findTile(a.tiles, 1, 2), { row: 1, col: 2, value: '2', text: '2', className: 'tile spawn' });
  });
});

describe('밀기와 합치기', () => {
  test('왼쪽: 나란한 두 타일이 합쳐지고 점수가 오른다', () => {
    const a = boot({ randomQueue: [0] });
    a.key('ArrowLeft');
    assert.strictEqual(a.score, '4');
    assert.strictEqual(a.tiles.length, 2);
    const merged = findTile(a.tiles, 1, 1);
    assert.strictEqual(merged.value, '4');
    assert.match(merged.className, /merged/);
    const spawned = findTile(a.tiles, 1, 2);
    assert.strictEqual(spawned.value, '2');
    assert.match(spawned.className, /spawn/);
  });

  test('오른쪽: 반대편 끝에서 합쳐진다', () => {
    const a = boot({ randomQueue: [0] });
    a.key('ArrowRight');
    assert.strictEqual(a.score, '4');
    const merged = findTile(a.tiles, 1, 4);
    assert.strictEqual(merged.value, '4');
    assert.match(merged.className, /merged/);
  });

  test('위: 같은 열의 두 타일이 위쪽에서 합쳐진다', () => {
    // 두 번째 스폰을 (1,0)에 놓으려면: (0,0)이 찬 뒤 남은 15칸 중 인덱스 3.
    // 0.21 * 15 = 3.15 → floor 3. (0.2를 쓰면 부동소수점 오차로 2가 나올 수 있어 피한다.)
    const a = boot({ randomQueue: [0, 0, 0.21, 0, 0, 0] });
    a.key('ArrowUp');
    assert.strictEqual(a.score, '4');
    const merged = findTile(a.tiles, 1, 1);
    assert.strictEqual(merged.value, '4');
    assert.match(merged.className, /merged/);
  });

  test('아래: 같은 열의 두 타일이 아래쪽에서 합쳐진다', () => {
    const a = boot({ randomQueue: [0, 0, 0.21, 0, 0, 0] });
    a.key('ArrowDown');
    assert.strictEqual(a.score, '4');
    const merged = findTile(a.tiles, 4, 1);
    assert.strictEqual(merged.value, '4');
    assert.match(merged.className, /merged/);
  });

  test('움직일 수 없는 방향으로 밀면 점수도 타일 수도 그대로다', () => {
    // (0,0)=2, (0,1)=2인 상태에서 위로 밀어도 둘 다 이미 맨 윗줄이라 변화가 없다.
    const a = boot({ randomQueue: [0] });
    a.key('ArrowUp');
    assert.strictEqual(a.score, '0');
    assert.strictEqual(a.tiles.length, 2);
  });

  test('스와이프로도 같은 방향 이동이 일어난다', () => {
    const a = boot({ randomQueue: [0] });
    a.swipe(-100, 0); // 왼쪽으로 스와이프
    assert.strictEqual(a.score, '4');
    assert.strictEqual(findTile(a.tiles, 1, 1).value, '4');
  });

  test('너무 짧은 스와이프는 탭으로 보고 무시한다', () => {
    const a = boot({ randomQueue: [0] });
    a.swipe(-5, 0);
    assert.strictEqual(a.score, '0');
    assert.strictEqual(a.tiles.length, 2);
  });
});

describe('새 게임 버튼', () => {
  test('누르면 점수와 보드가 초기화된다', () => {
    const a = boot({ randomQueue: [0] });
    a.key('ArrowLeft');
    assert.strictEqual(a.score, '4');

    a.click('newGameBtn');
    assert.strictEqual(a.score, '0');
    assert.strictEqual(a.tiles.length, 2);
    assert.strictEqual(a.overlayShown, false);
  });
});

describe('최고 점수', () => {
  test('점수를 넘으면 저장되고, 다음에 열어도 유지된다', () => {
    const storage = memoryStorage();
    const a = boot({ storage, randomQueue: [0] });
    a.key('ArrowLeft');
    assert.strictEqual(a.score, '4');
    assert.strictEqual(a.best, '4');

    const b = boot({ storage, randomQueue: [0] });
    assert.strictEqual(b.best, '4');
  });

  test('점수를 넘지 못하면 최고 기록은 그대로다', () => {
    const storage = memoryStorage([['g2048_best', '100']]);
    const a = boot({ storage, randomQueue: [0] });
    a.key('ArrowLeft');
    assert.strictEqual(a.score, '4');
    assert.strictEqual(a.best, '100');
  });
});

describe('저장소 장애 내성', () => {
  test('localStorage가 예외를 던져도 앱이 뜬다', () => {
    const a = boot({ storage: throwingStorage, randomQueue: [0] });
    assert.strictEqual(a.score, '0');
    assert.strictEqual(a.tiles.length, 2);
    a.key('ArrowLeft');
    assert.strictEqual(a.score, '4');
  });
});
