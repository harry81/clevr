# Phase 0 TIL — SQLite WAL / scrypt 해싱 / 트랜잭션 원자성

> WBS §5.3 학습 기록 | 2026-09-09 | Phase 0 (T1~T3) 완료 반영

## 1. SQLite WAL 모드와 동시성 (T2)

### WAL(Write-Ahead Logging) 동작 원리
- 일반 저널 모드(rollback journal)는 **쓰기 시 원본 페이지를 먼저 복사해두고**, 커밋 시 원본 DB 파일을 직접 덮어쓴다. 커밋 중 실패 시 복사본으로 복구한다.
- WAL 모드는 **쓰기를 별도 `-wal` 파일에 append**하고, 커밋 시점에는 DB 파일을 건드리지 않는다. 커밋 트랜잭션의 원자성은 WAL 프레임 체크섬으로 보장된다.
- 덕분에 **읽기(SELECT)는 WAL이 커밋되기 전에도 기존 스냅샷을 그대로 읽어** 쓰기와 읽기가 서로 블로킹하지 않는다. 동시성 ↑.
- 단점: `-wal`/`-shm` 파일이 커질 수 있고, 최초 `-wal` 크기만큼 디스크 공간이 필요. → **checkpoint**로 WAL을 메인 DB로 병합·비움.

### PRAGMA 설정 (WBS §1.3)
```sql
PRAGMA journal_mode = WAL;      -- 파일 DB에서만 'wal' 반환 (메모리 DB는 'memory')
PRAGMA synchronous = NORMAL;    -- WAL에서는 FULL이 아니라 NORMAL이 안전한 기본값
PRAGMA foreign_keys = ON;       -- SQLite는 기본 OFF (매 연결마다 설정 필수)
```
- **중요 함정**: `:memory:` DB는 `journal_mode=WAL`을 허용하지 않는다('memory' 유지). → 테스트에서 WAL 검증은 **반드시 실제 파일 경로로** 수행해야 한다. T2 테스트가 이 케이스를 잡아낸다.
- `synchronous=NORMAL`은 SQLite 공식 문서가 WAL 모드에서 권장하는 값. FULL과 동일한 내구성을 제공하면서 WAL 커밋 시점만 WAL 파일에 fsync한다.

### BEGIN IMMEDIATE vs BEGIN DEFERRED
- `BEGIN DEFERRED`(기본): 첫 SELECT/쓰기까지 락을 얻지 않는다. 두 트랜잭션이 동시에 읽기만 하다가 함께 쓰려 하면 `SQLITE_BUSY` 데드락 가능.
- `BEGIN IMMEDIATE`: **트랜잭션 시작 시점에 예약(reserved) 락을 즉시 획득**하여 쓰기 충돌을 시작부터 방지. 쓰기 트랜잭션에는 `BEGIN IMMEDIATE`가 원칙.
- node:sqlite `DatabaseSync`는 단일 연결 동기 실행이므로 실제 멀티 커넥션 경합은 드물지만, **온보딩(쓰기 다발)은 IMMEDIATE로 시작**하여 경합 시 조기 실패·재시도를 가능하게 한다.

### wal_checkpoint(TRUNCATE)
- `PRAGMA wal_checkpoint(TRUNCATE)`는 WAL을 메인 DB에 병합하고 **WAL 파일 크기를 0으로 truncate**. 백업/업데이트 전 호출하면 일관된 단일 파일 스냅샷을 얻는다.
- 반환 컬럼 `[busy, log, checkpointed]` — `busy=0`이면 완전 성공. T2에서 `walCheckpointTruncate()` 훅으로 노출.

## 2. 비밀번호 해싱: scrypt vs bcrypt (T1)

| 항목 | scrypt | bcrypt |
|---|---|---|
| 방식 | **메모리 하드(Memory-hard)** KDF | Blowfish 기반, CPU bound |
| 의존성 | Node 내장 `node:crypto` | 외부 라이브러리 (bcrypt/bcryptjs) |
| HW(ASIC) 내성 | 높음 (메모리 대역폭 병목) | 중간 (GPU 병렬화 가능) |
| 설정 파라미터 | N, r, p (메모리/시간) | cost factor |
| 네이티브 빌드 | 불필요 | bcrypt는 네이티브 빌드 필요 (Windows 설치 시 골치) |

- **선택: `crypto.scryptSync`** — WBS §1.3의 "추가 의존성 불필요"와 WBS §5.2 "네이티브 빌드 에러 요인 최소화"를 동시에 충족. 10인 이하 소규모 앱의 로그인 빈도에 scrypt cost 기본값으로 충분.
- **Salt**: 16바이트(128bit) 랜덤 → hex 32자. salt가 매번 달라 동일 비밀번호도 해시가 다름(T1 테스트 검증).
- **검증**: `crypto.timingSafeEqual`로 **상수시간 비교** — 문자열 `===` 비교는 타이밍 공격에 노출될 수 있으므로 사용 금지. scryptSync가 없으면 차이 시간이 노출될 수 있으나, 검증 대상(hash 길이)을 먼저 `Buffer.from(hex)`로 고정해 비교 길이를 일정하게 유지.

### 왜 평문 `1234` 저장이 문제인가 (T1→T3 연결)
- `db/localStore.js:113`의 `password: '1234'` 평문 시드는 DB 파일 탈취 시 **즉시 인증 탈취**. 해시 저장은 DB가 유출돼도 원문 복원을 실용적으로 불가능하게 만든다.
- Phase 0의 T1(해시) + T3(GENSYS 시드 제거)는 이 문제를 **저장 계층과 부트 계층 양쪽에서** 차단한다.

## 3. 트랜잭션 원자성 — 온보딩 단일 트랜잭션 (T3)

- 온보딩은 **회사 1행 + 사용자 1행 + 품목 N행**의 다중 쓰기. 중간 실패 시 일부만 남으면 "회사는 있는데 로그인 불가" 같은 깨진 상태가 된다.
- 해결: `BEGIN IMMEDIATE` → 전체 삽입 → `COMMIT`, 실패 시 `ROLLBACK`. T3 테스트 "잘못된 품목 시 전체 롤백"이 `companies/users/items` 모두 0건임을 검증한다.
- 검증 흐름(앞서 검증 → 이후 트랜잭션)과 달리, T3는 **트랜잭션 안에서 품목 검증**을 수행해 롤백 경로가 실제로 발동되도록 테스트했다(검증만 앞에 두면 롤백 경로가 미실행되어 원자성이 보장되지 않을 수 있음).

## 4. 남은 과제 (Phase 1+ 참고)
- `node:sqlite`는 Node v22.20에서 **실험(Experimental) 경고** 발생. 동작은 안정적이며, 프로덕션 채택 전 Node LTS 24에서 기본화 여부 확인 필요.
- GENSYS 잔재는 `db/localStore.js`(구 JSON 스토어)와 `main.js` 온보딩 IPC에 여전히 존재. Phase 2(T8)에서 메인 프로세스 IPC를 새 엔진으로 교체하면서 제거.