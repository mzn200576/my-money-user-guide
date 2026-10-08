# 내 돈 사용 설명서 — Vercel 배포판

실험경제, 역할별 자산배분, MPT, 35문항 투자성향테스트를 제공하는 수업용 웹앱입니다.
이 버전은 Next.js 서버를 Vercel에서 실행하고, 계정·방·주문·학습 결과를 Supabase PostgreSQL에 저장합니다.
학생은 웹앱에서 아이디로 회원가입합니다. 학생에게 ChatGPT·Vercel·Supabase 계정은 필요하지 않습니다.

## 기존 수업 데이터베이스: 배당 추첨 기능 활성화

이미 사용 중인 **해당 수업의 Supabase 프로젝트**에서 **SQL Editor → New query**를 열고
[`supabase/migrations/0002_market_dividend_reveal.sql`](supabase/migrations/0002_market_dividend_reveal.sql)
전체를 붙여 넣어 한 번 실행합니다. 이 파일은 기존 계정·방·거래 데이터를 삭제하지 않으며 트랜잭션으로 실행됩니다.
**기존 데이터베이스에 `supabase/setup.sql`을 다시 실행하지 마세요.**

완료 후 `select public.market_dividend_v2_available();`의 결과가 `true`인지 확인합니다.
다음 장부터 **장 마감·거래 체결 → 현금 정산 확인 → 선생님의 배당 결정 → 모든 참가자의 8초 돌림판 → 지급 결과** 순서로 진행합니다.
기존에 마감한 장의 배당을 다시 추첨하거나 지급하지 않습니다.
업데이트 전에도 앱은 종전 방식대로 장 마감과 배당을 한 번에 정산하며, 선생님 화면에 안내가 표시됩니다.

## 준비된 상태

- 최신 회원가입 버튼/자동완성 수정과 기존 수업 기능을 포함합니다.
- Vercel 빌드 설정, 서버 환경변수 예시, 새 데이터베이스용 SQL을 포함합니다.
- 방 입장과 잔고 생성은 한 트랜잭션으로 처리합니다. 주문 저장과 장 마감은 방을 잠그고 버전을 확인합니다.
- 운영 빌드 및 로컬 HTTP 어댑터·인증 테스트 7개를 통과했습니다.
- GitHub와 Vercel 운영 배포가 연결되어 있습니다. 기존 Supabase에 위 배당 추첨 마이그레이션을 적용해야 새 흐름이 활성화됩니다.
- 로컬 테스트는 REST 응답을 대체합니다. 실제 PostgreSQL 함수 실행·RLS·브라우저 동시 접속을 검증한 결과는 아닙니다.

## 1. GitHub에 새 저장소 만들기

1. https://github.com/new 에서 개인 계정의 새 저장소를 만듭니다.
2. 이름 예시: `my-money-user-guide`. 소스 공개가 필요 없으면 **Private**을 선택합니다.
3. README/라이선스 자동 생성은 선택하지 않고 빈 저장소를 만듭니다.
4. 받은 ZIP을 압축 해제합니다. **ZIP 자체가 아니라 안의 소스 파일**을 업로드합니다.
5. 저장소의 `uploading an existing file` 또는 `Add file → Upload files`를 선택합니다.
6. 최상위에 `package.json`, `vercel.json`, `app`, `components`, `db`, `supabase`가 보여야 합니다.
7. GitHub 웹 업로드는 한 번에 100개 파일까지이므로, 먼저 `components`를 제외한 파일/폴더를 올리고 커밋한 다음 `components` 폴더를 올려 커밋합니다. 두 번 모두 `main`에 올립니다.

큰 폴더 업로드가 불편하면 GitHub Desktop으로 새 저장소를 Clone한 뒤 압축 해제한 내용을 복사하고 **Commit to main → Push origin**을 누르면 됩니다.
기존의 다른 앱 저장소에 덮어쓰지 마세요. 소스 파일에 실제 비밀번호나 Supabase 키를 쓰지 마세요.

## 2. Supabase 데이터베이스 만들기

1. https://supabase.com/dashboard 에서 로그인하고 새 Free 프로젝트를 만듭니다.
2. 수업용 전용 프로젝트로 만들고, 지역은 수업 장소에 가까운 곳을 선택합니다.
3. 프로젝트가 준비되면 **SQL Editor → New query**를 엽니다.
4. 이 패키지의 `supabase/setup.sql` 전체 내용을 붙여 넣고 **Run**을 누릅니다.
5. 성공 후 Table Editor에서 `users`, `rooms`, `room_members`, `market_orders` 등의 테이블을 확인합니다.
6. 프로젝트의 **Connect / Data API**에서 Project URL, **Settings → API Keys**에서 서버용 **Secret key**를 찾습니다. 새 Secret key는 `sb_secret_`로 시작합니다.

`setup.sql`은 **비어 있는 새 프로젝트에 한 번만 실행**합니다. 오류가 나면 내용을 지우거나 테이블을 삭제하지 말고 오류를 확인합니다.
이 파일은 트랜잭션으로 실행되므로 중간 실패 시 전체가 취소됩니다.
기존 ChatGPT Sites의 계정·방·기록을 자동으로 가져오지 않습니다. 새 배포에서는 새로 가입하며, 기존 데이터가 필요하면 별도 이전 작업을 해야 합니다.

이 앱은 Supabase Auth가 아닌 자체 아이디/비밀번호 로그인을 사용합니다.
학생 계정은 `public.users`에 저장되므로 Supabase의 **Authentication → Users** 목록에는 나오지 않습니다.

## 3. Vercel에 GitHub 연결하고 처음 배포하기

1. https://vercel.com/new 에 접속합니다.
2. **Import Git Repository**에서 GitHub를 연결합니다.
3. Vercel GitHub 앱 권한 화면이 나오면 방금 만든 저장소에 접근을 허용합니다.
4. 해당 저장소 옆의 **Import**를 누릅니다.
5. 다음 설정을 확인합니다.

| 설정 | 값 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | 저장소 루트 `./` |
| Production Branch | `main` |
| Node.js | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Next.js 기본값 유지 |

6. **Environment Variables**에 아래 3개를 추가합니다. 운영용 값은 **Production**에 설정합니다.

| 이름 | 넣을 값 |
| --- | --- |
| `SUPABASE_URL` | Supabase의 Project URL. 예: `https://프로젝트식별자.supabase.co` |
| `SUPABASE_SECRET_KEY` | 해당 프로젝트의 서버용 Secret key |
| `TEACHER_SIGNUP_CODE` | 직접 정한 충분히 긴 선생님 등록 코드 |

Secret key는 데이터베이스 비밀번호나 Publishable/Anon key와 다릅니다.
키와 선생님 코드는 Vercel의 설정에 입력합니다. GitHub·수업 자료·채팅에 넣지 않습니다.
이 세 변수에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. OpenAI API 키는 사용하지 않습니다.

7. **Deploy**를 누릅니다.
8. 배포 상태가 **Ready**가 되면 프로젝트의 **Domains**에 표시된 운영 `…vercel.app` 주소를 엽니다.

Import 때 환경별 범위를 선택할 수 없다면 배포 후 **Settings → Environment Variables**에서 Production 범위를 확인하고 다시 배포합니다.
환경변수를 추가하거나 바꾸면 **Deployments → 해당 배포 메뉴 → Redeploy**를 실행해야 새 값이 반영됩니다.
미리보기(Preview)에도 로그인이 필요하면 별도 테스트 Supabase 프로젝트를 만들어 Preview용 값을 설정합니다.

## 4. 자동 배포 확인하기

Vercel에 GitHub 저장소를 연결하면 기본 Git 자동 배포가 작동합니다.
별도의 GitHub Actions 파일, Vercel 토큰, 웹앱 안의 배포 버튼은 필요하지 않습니다.

- **Settings → Git**: 올바른 GitHub 저장소가 연결됐는지 확인합니다.
- **Settings → Environments → Production → Branch Tracking**: `main`인지 확인합니다.
- GitHub에서 README 한 줄을 수정하고 `main`에 커밋합니다.
- Vercel **Deployments**에 새 배포가 나타나고 **Ready**가 되는지 확인합니다.
- 이후 `main`에 수정사항을 push하거나 PR을 merge할 때 운영 웹이 갱신됩니다.
- 다른 브랜치는 Preview 주소가 생깁니다. 운영 DB 환경변수를 공유하지 않으면 로그인·저장은 작동하지 않을 수 있습니다.

자동 배포의 입력은 **연결된 GitHub 저장소의 커밋**입니다.
이 채팅에서 코드를 수정하거나 기존 ChatGPT Sites를 게시하는 것만으로 Vercel이 바뀌지는 않습니다.
후속 수정 시 이 Vercel용 저장소에 변경사항을 올려야 합니다.

SQL 변경은 코드 배포와 별개입니다.
`main`에 코드를 올려도 DB 테이블 변경은 자동 적용되지 않습니다.
후속 DB 변경은 추가 마이그레이션으로 검토·적용하며, 초기 `setup.sql`을 다시 실행하지 않습니다.

## 5. 학생에게 공유하기 전에

1. 운영 주소를 시크릿 창에서 열어 ChatGPT나 Vercel 로그인 화면이 나오지 않는지 확인합니다.
2. Vercel 인증 화면이 나오면 **Settings → Deployment Protection**에서 운영 도메인이 공개 범위인지 확인합니다. 학생에게는 Preview 주소 대신 운영 도메인을 공유합니다.
3. 선생님으로 회원가입할 때 위에서 정한 등록 코드를 입력합니다.
4. 별도 브라우저/기기에서 학생으로 회원가입합니다. 학생은 이메일·등록 코드를 입력하지 않습니다.
5. 실험경제 방을 만들고 학생 두 명이 코드로 입장해 서로 반대 주문을 제출합니다. 선생님이 장 마감을 눌러 거래 잔고를 확인한 뒤 배당 결정을 눌러 두 학생의 돌림판과 배당금 변화를 확인합니다.
6. 자산배분 방에서 역할 부여 → 배분 제출 → 충격 공개를 확인합니다. 공개 전에는 학생 화면에 충격이 보이지 않아야 합니다.
7. MPT·투자성향 결과를 저장한 뒤 다시 로그인해 자신의 결과가 유지되는지 확인합니다.

## 무료 사용과 수업 운영

Vercel Hobby는 비상업적 개인 사용 조건의 무료 요금제입니다. 기관 서비스·유료 강의 운영은 요금제 조건을 별도로 확인해야 합니다.
Supabase Free는 최근 7일 사용량이 적으면 프로젝트가 일시 중지될 수 있습니다.
수업 전에 Dashboard에서 실행 상태를 확인하고, 중지됐다면 **Resume project**로 복구한 뒤 로그인·방 입장을 점검합니다.
무료 한도 초과 시 계속 무료로 동작한다고 보장할 수는 없습니다. 두 서비스의 Usage 화면을 확인하세요.

## 개발 명령

```bash
npm ci
npm test
npm run build
```

로컬 실행은 프로젝트 연결과 Development용 데이터베이스 환경변수 준비를 먼저 완료한 뒤 진행합니다.
Vercel CLI를 쓰면 `vercel link` 후 `vercel env pull .env.local`로 가져오고 `npm run dev`를 실행합니다.
`npm run db:setup-file`은 포함된 SQL 세 개를 합쳐 **새 프로젝트용** `supabase/setup.sql`을 다시 만드는 로컬 파일 생성 명령입니다. DB에 접속하거나 변경하지 않습니다.
운영 서버를 로컬에서 실행하려면 빌드 후 `npm start`를 사용합니다.

## 문제 해결

| 증상 | 확인할 항목 |
| --- | --- |
| Vercel에 저장소가 안 보임 | Vercel GitHub 앱이 새 저장소에 접근 가능한지 확인 |
| Build에서 package.json을 못 찾음 | 저장소 루트와 Root Directory 확인 |
| 화면은 뜨는데 회원가입 실패 | Production 환경변수, Supabase 실행 상태, setup.sql 실행 여부 확인 |
| 선생님 가입만 실패 | TEACHER_SIGNUP_CODE 값과 입력 코드 일치 확인 |
| 방 입장/주문 시 함수가 없다고 나옴 | setup.sql에 포함된 join_classroom/save_market_order/apply_market_close 생성 여부 확인 |
| 장 마감 시 다시 누르라는 안내 | 계산 중 주문/참가자가 바뀐 경우. 잠시 후 마감을 다시 실행 |
| main에 올렸는데 배포 안 됨 | Git 연결, Production Branch, Deployments의 상태/오류 확인 |
| 새 환경변수를 넣었는데 그대로임 | 해당 환경을 대상으로 Redeploy 실행 |

## 공식 안내

2026-10-01 확인:
- GitHub 파일 업로드: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Vercel Git 자동 배포·운영 브랜치: https://vercel.com/docs/git
- Vercel 환경변수: https://vercel.com/docs/environment-variables
- Vercel 배포 접근 설정: https://vercel.com/docs/deployment-protection
- Vercel Hobby 조건: https://vercel.com/docs/plans/hobby
- Supabase API 키: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase 프로젝트 중지/복구: https://supabase.com/docs/guides/platform/free-project-pausing
