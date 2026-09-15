> **CJ 중지 후속 반영(2026-09-15):** 성능 확보 요청으로 기존 CJ·구버전 Node 3개와 CJ AI를 중지하고 자동 시작을 해제했다. CJ DB 계정도 잠갔다. 금융교육 서비스·MySQL·Nginx는 유지한다. 아래 “기존 CJ 유지”는 최초 구성 시점 기록이다. [중지 대상·복구 방법](CJ-서비스-일시중지-2026-09-15.md).

# 금융교육 DB·서버 구성 현황 — 2026-09-15

9월 20일 수업용 DB와 Node·AI 서비스를 기존 EC2 안에 분리해 구성했다. 백엔드 코드도 전용 디렉터리에 배치하고 서버 내부에서 실행했다. 기존 CJ 서비스·DB 및 공용 Nginx 설정은 변경하지 않았다. 프런트 공개 배포와 도메인 연결은 아직 하지 않았다.

## 실제 구성

| 항목 | 설정 |
|---|---|
| EC2 | `15.165.133.9` / `ip-172-31-31-216` |
| 행사 DB | `financial_education_20260920` |
| DB 계정 | `finedu_20260920@localhost` |
| DB 권한 | 행사 DB에만 SELECT·INSERT·UPDATE·DELETE |
| OS 실행 계정 | `financial-education` / 로그인 불가 시스템 계정 |
| Node 서비스 | `financial-node.service`, `127.0.0.1:3100` |
| AI 서비스 | `financial-ai.service`, `127.0.0.1:8100` |
| Node 소스 | `/srv/financial-education/web/server` |
| AI 소스·가상환경 | `/srv/financial-education/ai`, 하위 `.venv` / Python 3.12.3 |
| 환경 파일 | `/etc/financial-education/node.env`, `ai.env` / root 소유 600 |
| 토론 아카이브 | `/srv/financial-education/data/chat_archives` |
| 초기 DB 백업 | `/var/backups/financial-education/initial-schema-20260915.sql.gz` / root 전용 |
| 배치 소스 기록 | `/srv/financial-education/source-manifest.json` / 40개 파일 SHA256 |

Node에는 새 DB 비밀번호와 행사 전용 JWT secret을 생성했다. AI는 기존 로컬 AI 프로젝트의 키를 전용 환경 파일에 설정했다. 비밀값은 이 문서나 Git 파일에 기록하지 않았다. 전송용 임시 파일은 서버와 로컬에서 제거했다.

별도 프로세스·DB·계정·파일 경로를 분리한 구성이며, EC2의 디스크·메모리·MySQL 프로세스 자체는 기존 서비스와 공유한다. 새 EC2 인스턴스나 RDS를 생성하지 않았다.

## 확인한 내용

- 두 서비스 `active`, 재시작 횟수 0, 재부팅 시 시작하도록 enable.
- Node `/health` 정상, AI `/health` 정상. AI 키 설정 여부는 true이며 실제 모델 연결을 검사하는 health는 아니다.
- Node의 두 DB pool 모두 행사 DB와 전용 계정에 연결됨.
- 전용 계정의 기존 `cjdb`, `AigoraWeb` 접근이 모두 거부됨.
- 9개 테이블 생성. 4차시 점수 열의 쓰기·읽기를 트랜잭션으로 확인한 뒤 롤백했다. 실제 참여자 행은 0개다.
- 실행 계정의 아카이브 쓰기 권한 확인 후 확인용 파일 제거.
- 배치한 40개 소스 파일의 SHA256이 로컬 작업본 기록과 일치함.
- 기존 `cj-node`, `cj-ai`의 PID가 구성 전후 동일하며 재시작하지 않았다.

## 남은 설정

1. **교육 접속 주소·프런트 배포**: 실제 도메인/DNS·인증서와 Nginx 연결, 해당 주소로 CORS 및 프런트 API 설정. 현재 3100·8100은 서버 내부에서만 접근 가능하다. CORS는 로컬 확인 주소만 등록했다.
2. **디스크 여유**: 구성 후 약 846MB로 사용률 96%다. 수업 전에 공간을 확보하거나 디스크를 증설해야 한다. 기존 서비스 파일·로그를 임의로 삭제하지 않았다. 영상 원본을 이 디스크에 올리지 않는다.
3. **AI 크레딧**: 이전 실제 호출은 크레딧 소진이었다. 이번 구성에서는 모델 요청을 실행하지 않았다. 크레딧 복구와 정상 응답 확인은 별도다.
4. **수업 시간 설정**: `ROOM_MAX_AGE_MS=1200000`(20분)은 기존 준비 템플릿 값이다. 실제 토론 시간표가 확정되면 맞춘다.
5. **최종 코드 반영**: 배치 소스는 `codex/financial-education`의 미커밋 작업본이다. 후속 작업으로 학생 이론 유지·퀴즈 방식이 확정됐고, 교사 퀴즈 동기화 Node 코드가 반영됐다. 프런트 외부 배포는 아직이다. Git push는 하지 않았다.

## 운영 확인 명령

서버에서:

```sh
systemctl status financial-node financial-ai --no-pager
curl -fsS http://127.0.0.1:3100/health
curl -fsS http://127.0.0.1:8100/health
df -h /
```

필요할 때 행사 서비스만 재시작한다. 공용 Nginx·MySQL·기존 CJ 서비스를 행사 서비스로 오인해 재시작하지 않는다. DB 스키마 파일은 새 DB에 한 번 적용했으며, 외래키 추가문이 있어 같은 파일을 다시 실행하는 배포 절차로 사용하지 않는다.
