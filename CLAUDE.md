# claude-mini-apps

간단한 바닐라 HTML/CSS/JS 미니 앱 모음. 각 앱은 폴더 하나 + `index.html` 단일 파일 구조.

- `focus-timer/index.html` — 포커스 타이머
- `particle-canvas/index.html` — 파티클 캔버스

## 코드 규칙

- 빌드 도구·번들러 없음. `index.html` 하나에 HTML/CSS/JS를 모두 담는다.
- 외부 의존성 추가 금지. 브라우저 기본 API만 사용한다.
- 새 앱은 최상위에 `<앱이름>/index.html` 형태로 추가한다.
- 확인 방법: 해당 `index.html`을 브라우저로 직접 연다.

위 규칙은 **앱 코드**에 적용된다. `tests/`의 테스트 도구는 예외이며, CI에서만 쓰이고
앱에 번들되지 않는다.

## 테스트

```sh
node --test tests/*.test.js          # 의존성 없음 — 구조 규칙 + 로직
npm i --no-save playwright           # 브라우저 테스트에만 필요
npx playwright install chromium
node --test tests/browser/*.test.js  # 실제 Chromium
```

- `tests/structure.test.js` — 위 "코드 규칙"을 CI에서 강제한다. 앱은 최상위에서
  `index.html`을 가진 폴더로 자동 인식되므로, 새 앱을 추가하면 별도 등록 없이 검사된다.
- `tests/focus-timer.test.js`, `tests/particle-canvas.test.js` — 가짜 시계와 DOM 대역 위에서
  스크립트를 실행한다. 25분 세션이나 백그라운드 탭 스로틀링을 즉시 재현할 수 있다.
- `tests/browser/` — Node 대역이 잡지 못하는 것을 잡는다. CSS 특이도 회귀, 실제 이벤트
  발생 순서, 캔버스에 찍힌 픽셀. 두 계층 모두 있어야 하며, 한쪽만으로는 부족하다.

playwright가 없으면 브라우저 테스트는 건너뛰되, `CI=true`에서는 조용히 통과하지 않고 실패한다.

## 응답 규칙

- 한국어로 답한다.
- 인사말·중복 설명은 생략하고 핵심만 간결하게 쓴다.

## 작업 흐름

복잡한 기능은 아래 순서로 진행한다. (별도 플러그인 없이, 대화 단계로 진행)

1. 요구사항 정리 — 목적, 핵심 요구사항, 예외 케이스, 완료 기준
2. 작업 분해 — 수정할 파일과 단계별 순서
3. 구현
4. 동작 확인
5. 코드 검토 — 이 저장소에서는 `/code-review` 사용

## 환경 참고

사용자의 로컬 맥북에는 ponytail 플러그인, `/spec` `/plan` `/build` `/test` `/review`,
Graphify, OmniRoute, 블로그 자동화 스케줄러가 설치되어 있다.
이들은 **로컬 전용**이며 웹(클라우드) 세션에는 로드되지 않는다.
웹 세션에서는 위 "작업 흐름"의 대화 단계와 `/code-review` 등 기본 스킬로 대체한다.
