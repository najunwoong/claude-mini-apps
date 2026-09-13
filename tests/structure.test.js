'use strict';
// CLAUDE.md에 적힌 프로젝트 규칙을 CI에서 강제한다.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { APPS, appDir, readApp, extractScript } = require('./lib/app');

test('앱이 하나 이상 발견된다', () => {
  assert.ok(APPS.length > 0, '최상위에서 index.html을 가진 폴더를 찾지 못했습니다');
  console.log('  검사 대상:', APPS.join(', '));
});

for (const app of APPS) {
  describe(app, () => {
    const html = readApp(app);

    test('인라인 스크립트의 구문이 유효하다', () => {
      assert.doesNotThrow(() => new vm.Script(extractScript(app)));
    });

    test('앱 폴더에 index.html 하나만 있다', () => {
      const files = fs.readdirSync(appDir(app));
      assert.deepStrictEqual(files, ['index.html'],
        `단일 파일 원칙 위반 — 발견된 파일: ${files.join(', ')}`);
    });

    test('외부 스크립트를 불러오지 않는다', () => {
      assert.ok(!/<script[^>]+\bsrc\s*=/i.test(html), '<script src=...>가 있습니다');
    });

    test('외부 스타일시트를 불러오지 않는다', () => {
      assert.ok(!/<link[^>]+\bhref\s*=/i.test(html), '<link href=...>가 있습니다');
      assert.ok(!/@import/i.test(html), 'CSS @import가 있습니다');
    });

    test('원격 이미지·폰트를 참조하지 않는다', () => {
      assert.ok(!/<img[^>]+\bsrc\s*=\s*["']https?:/i.test(html), '원격 <img src>가 있습니다');
      assert.ok(!/url\(\s*["']?https?:/i.test(html), 'CSS에서 원격 url()을 참조합니다');
    });

    test('네트워크를 호출하지 않는다', () => {
      const js = extractScript(app);
      assert.ok(!/\bfetch\s*\(/.test(js), 'fetch() 호출이 있습니다');
      assert.ok(!/XMLHttpRequest/.test(js), 'XMLHttpRequest 사용이 있습니다');
    });

    test('한국어 문서로 선언되어 있다', () => {
      assert.match(html, /<html lang="ko">/);
      assert.match(html, /<meta charset="UTF-8">/i);
    });

    test('모바일 뷰포트가 설정되어 있다', () => {
      assert.match(html, /<meta name="viewport"/i);
    });
  });
}
