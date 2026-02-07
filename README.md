# Salesmap 풀스택 개발자 과제 구현 README

## 프로젝트 소개

이 프로젝트는 세일즈 CRM의 축소판을 목표로 하되 **기능 동작뿐 아니라 설계의 의도와 일관성**이 코드 전반에서 읽히도록 구성했습니다. 평가 기준에 맞춰 구조/가독성/일관성/예외 처리를 명확하게 드러내는 것을 최우선으로 삼았습니다.

## 핵심 구현 요약

- 인증: JWT + HttpOnly 쿠키, 만료 7일, 기본 해시 처리
- 권한: A/B/C 계층, 상위 → 하위 조회 가능
- 파이프라인: 멀티 파이프라인, 스테이지 CRUD + 순서 변경
- 딜: 칸반 UI + Drag & Drop(dnd-kit)
- 오브젝트: 딜/리드/고객/회사 확장, 최소 CRUD 제공
- 커스텀 필드: text/number/date/datetime, 필수/마스킹/노출 옵션 지원
- 필터: AND 조건, is / is not, 기본/커스텀 필드 모두 지원

## 기술/구조 선택 이유

- Next.js(App Router): 페이지, API, 레이아웃을 한 프로젝트에서 일관되게 관리하여 설계 의도와 책임 분리를 구조적으로 드러냈습니다.
- MySQL + Prisma: 요구 스택을 만족하면서 마이그레이션/시드/타입 안정성을 확보해 유지보수성과 신뢰도를 높였습니다.
- JWT + HttpOnly 쿠키: 클라이언트의 보안 책임을 최소화하고 서버가 인증을 일관되게 검증하도록 단순화했습니다.
- dnd-kit: 칸반 보드의 카드 이동 규칙을 명확히 제어하고 불필요한 의존성 없이 필요한 동작만 구현했습니다.
- Tailwind CSS: UI 완성도보다 레이아웃 구조와 사용자 흐름을 전달하는 데 집중하기 위해 최소한의 스타일만 적용했습니다.
- 정책 로직 분리: 정책 판단을 `src/lib`로 모아 API가 일관된 규칙을 강제하도록 설계했습니다.

## 설계 품질

### 구조적 설계

- 기능/도메인 기준 분리: UI는 `src/components`, 정책/인증/공통 로직은 `src/lib`, 타입은 `src/types`로 분리했습니다.
- 책임 분리: API 라우트는 입출력 검증과 정책 적용만 담당하고 정책 판단은 `src/lib/policy.ts`로 고립했습니다.
- 반복 최소화: 공통 응답은 `src/lib/http.ts`, 파라미터 파싱은 `src/lib/ids.ts`로 통일했습니다.

### 가독성

- 네이밍은 역할이 드러나게 구성했습니다.
- 복잡한 로직은 의미 단위로 분리했습니다. (필터, 권한, 파이프라인 정렬은 각각 별도 함수.)
- 주석은 최소화하고 로직 자체가 의도를 설명하도록 했습니다.

### 일관성

- 모든 API는 `jsonOk/jsonError`로 동일한 응답 포맷을 사용합니다.
- 정책은 UI가 아닌 API에서 통제하여 우회 요청도 동일한 규칙으로 처리합니다.
- 동일한 문제는 동일한 접근을 사용합니다. (삭제 조건과 정렬 조건은 전 라우트에 동일 기준 적용.)

### 예외/비즈니스 로직 처리

- 스테이지 최소 3개 유지
- 딜이 있는 스테이지 삭제 불가
- 딜이 있는 파이프라인 삭제 불가
- 파이프라인 최소 1개 유지
- 권한 없는 딜 접근 차단
- 커스텀 필드 타입 변경은 값이 있으면 차단
- 예외는 모두 API에서 검증되며 UI 상태와 무관하게 일관된 정책을 보장합니다.

## 비즈니스 정책 요약

- 권한 정책: A는 A/B/C, B는 B/C, C는 본인 딜만 조회
- 스테이지 정책: 딜이 존재하면 삭제 불가, 최소 3개 유지
- 파이프라인 정책: 딜이 존재하면 삭제 불가, 최소 1개 유지
- 필터 정책: AND + is/is not으로 예측 가능하고 단순한 규칙 유지
- 커스텀 필드 삭제: soft delete로 값 보존

## 정책 적용 위치 (API 매핑)

| 정책 | 적용 위치 |
| --- | --- |
| 권한 조회 범위(A/B/C) | `src/lib/policy.ts`, `src/app/api/deals/route.ts` |
| 스테이지 삭제 조건(딜 존재/최소 3개) | `src/app/api/stages/[stageId]/route.ts` |
| 파이프라인 삭제 조건(딜 존재/최소 1개) | `src/app/api/pipelines/[pipelineId]/route.ts` |
| 커스텀 필드 타입 변경 제한 | `src/app/api/custom-fields/[fieldId]/route.ts` |
| 딜 이동 시 스테이지 검증 | `src/app/api/deals/[dealId]/route.ts` |

## 주요 폴더 구조

- `src/app`: 페이지, API 라우트
- `src/components`: UI 컴포넌트
- `src/components/pipeline`: 딜/칸반 관련 컴포넌트
- `src/components/object`: 리드/고객/회사 관리 컴포넌트
- `src/lib`: 인증/정책/DB/공통 응답/ID 파싱
- `src/types`: 도메인 타입 정의

## 주요 기능 상세

### 인증

- 회원가입 / 로그인 / 로그아웃 구현
- JWT를 HttpOnly 쿠키로 전달
- 첫 가입자는 자동 A 역할
- 만료 7일 (`JWT_EXPIRES_IN=7d`)

### 권한 (A/B/C 계층)

- A: A/B/C 딜 조회 가능
- B: B/C 딜 조회 가능
- C: 본인 딜만 조회 가능
- B는 A를 매니저로, C는 B를 매니저로 선택

### 파이프라인/스테이지

- 멀티 파이프라인 지원
- 스테이지 구성: 이름 / 가능성 / 설명 / 정체 기준일
- 스테이지 순서 변경 지원
- 삭제는 조건부 정책 적용

### 딜

- 스테이지 별 칸반 UI 구성
- dnd-kit 기반 Drag & Drop 이동
- 이동 실패 시 자동 롤백

### 리드/고객/회사

- 오브젝트별 목록/생성/수정/삭제(soft delete) 제공
- 담당자 기준 권한 적용
- 커스텀 필드 입력 및 표시 지원

### 커스텀 필드

- 타입: text, number, date, datetime
- 필수/데이터 마스킹/노출 옵션 지원
- `visible_in_create`, `visible_in_pipeline`로 화면 노출 분리
- 필드 관리 페이지에서 생성/수정 가능
- 마스킹 필드는 검색/필터에서 제외

### 필터링

- AND 조건, is / is not 연산 지원
- 기본 필드 + 커스텀 필드 모두 적용
- 텍스트는 대소문자 구분 없이 비교

## 실행 방법

### 1) 환경 변수

`.env`

```
DATABASE_URL="mysql://root:1234@localhost:3306/salesmap_test"
JWT_SECRET="salesmap-secret-please-change-1234567890"
JWT_EXPIRES_IN="7d"
```

### 2) DB 마이그레이션 & 시드

```
pnpm db:migrate
pnpm db:seed
```

### 3) 개발 서버 실행

```
pnpm dev
```

접속: `http://localhost:3000`

## 주요 페이지

- `/login`: 로그인
- `/signup`: 회원가입
- `/pipeline`: 딜 파이프라인
- `/leads`: 리드
- `/contacts`: 고객
- `/companies`: 회사
- `/settings/pipelines`: 파이프라인/스테이지 설정
- `/settings/fields`: 커스텀 필드 설정

## 기술 스택

- Next.js (App Router)
- MySQL + Prisma
- dnd-kit
- JWT + HttpOnly Cookie
- Tailwind CSS

## 설계 의도 요약

이 과제는 기능 구현보다 **설계 의도와 일관성**을 더 중요하게 평가합니다.
설계 의도를 요약하자면 아래와 같습니다.

- 정책 판단을 한 곳(`src/lib/policy.ts`)에 집중
- 예외를 UI가 아닌 API에서 통제
- 반복되는 응답 포맷과 파라미터 파싱을 통일

위와 같은 방식으로 **읽히는 설계**를 목표로 구성했습니다.

## 프로젝트 구조

```
src/
  app/                 페이지와 API 라우트 (App Router)
    (auth)/            로그인/회원가입 페이지 그룹
    (app)/             인증 이후 주요 페이지 그룹
    api/               서버 API 라우트
  components/          공용 UI 컴포넌트
    pipeline/          딜/파이프라인 관련 UI 컴포넌트
    object/            리드/고객/회사 관리 UI 컴포넌트
  lib/                 인증/정책/DB/공통 유틸
  types/               도메인 타입 정의
prisma/                스키마, 마이그레이션, 시드
public/                정적 파일
```

- `src/app`: 화면과 API가 함께 위치하여 기능 단위로 묶임
- `src/components`: 화면 구성 요소를 재사용 가능한 단위로 분리
- `src/lib`: 인증/권한/정책/DB/응답 포맷 등 서버 중심 로직을 집중
- `src/types`: 프론트/백 모두 공유하는 도메인 타입
- `prisma`: 스키마와 마이그레이션/시드 관리
- `public`: 정적 파일
