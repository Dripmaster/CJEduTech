# 금융교육 웹 배포 — 2026-09-15

## 배포 경로

- 운영 웹: https://www.aigora.kr
- Vercel: Dripmaster's projects / aigora (`prj_iJS6HFmkJzfTyiiuzZHid0jGYC7r`)
- 자동 배포 저장소: **Dripmaster/CJEduTech**, production branch **main**.
- 로컬 `origin`은 imNaNye/CJEduTech이므로 배포 대상과 다르다. `deployment` remote를 추가했다.
- 기존 배포 main은 `28a96edcd38e9625f1df8c0b207993d1fe713f29`. 현재 금융교육 작업의 조상이므로 기존 fork 변경을 덮어쓰지 않는다.
- `codex/financial-education` → PR → main 병합 → Vercel 자동 빌드 → Ready 및 운영 도메인 확인.
- Vercel preset Vite, Node 22.x, 루트 디렉터리 기본값. `vercel.json`에서 buildCommand `npm run build`, outputDirectory `dist-financial` 지정.
- Vercel 기존 `VITE_API_URL`과 `VITE_SOCKET_URL`은 모두 `https://api.aigora.kr`. 환경변수 변경은 필요 없다.

## API와 디스크

- 기존 api.aigora.kr의 Nginx `/api/`, `/socket.io/` upstream을 금융교육 Node `127.0.0.1:3100`으로 전환했다.
- AI는 내부 `127.0.0.1:8100`, DB는 `financial_education_20260920`을 유지한다.
- 공개 웹 `https://www.aigora.kr`, `https://aigora.kr`를 금융교육 Node CORS에 추가했다.
- 변경 전 Nginx와 Node 환경 파일: `/var/backups/financial-education/before-public-web-20260915/` (서버 root 전용).
- nginx -t 성공, public `/api/auth/me`는 비로그인 401 JSON 및 CORS credentials 응답, Socket.IO polling handshake 정상.
- Conda tarball/index cache 및 오래된 systemd journal 정리: 여유 약 855MB(96% 사용) → 2.2GB(89% 사용). journal은 150MB 기준으로 정리했다. 8GB 스왑, DB, 서비스 코드, 영상, 백업은 유지했다.

## 이번 화면 수정

교사만 영상을 재생한다. 학생은 기존 주황 안내 카드와 로봇 디자인으로 강사 화면 시청을 안내받고, 기존처럼 10초 뒤 활성화되는 다음 버튼으로 토론에 진입한다. 기존 이미지에 포함됐던 CJ 인재상 문구는 금융교육 4개 축 문구로 바꾸었다. 학생에게 영상 URL을 로딩하지 않는다.

## 검증 및 남은 범위

- 자동 테스트 8개 통과(20명 퀴즈 동기화 포함), 수정 JSX lint 및 production build 성공.
- 로컬 브라우저: 학생 플레이어 없음, 10초 대기/수동 토론 이동, 교사 영상 미등록 안내 확인.
- 배포 완료 여부는 Vercel Ready와 실제 운영 도메인에서 새 파일·API를 확인해야 확정한다.
- 3·4차시 퀴즈 원본 및 영상 4개는 미수령 상태다. 임의 콘텐츠를 채우지 않았다.
- AI 실호출 정상 응답은 크레딧 복구 후 확인 필요. 서버 health 성공과 구별한다.
- 기존 토론 타이머는 상태 조회마다 남은 시간이 초기화되는 동작이 있다. 교사의 수동 종료로 진행 가능하며 이번 웹 배포에서 타이머 방식을 바꾸지는 않았다. 수업 리허설에서 확인할 사항이다.

## 복구

웹은 Vercel의 이전 production deployment 또는 위 baseline 커밋으로 복구할 수 있다. CJ 서비스를 복구하려면 웹 롤백만으로는 부족하다. 기존 CJ 중지 문서에 따라 필요한 서비스와 DB 계정을 복구하고, 공개 API upstream과 CORS도 함께 이전 구성으로 돌려야 한다. 금융교육 DB를 CJ DB로 덮어쓰지 않는다.
