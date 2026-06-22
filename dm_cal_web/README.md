# The More (dm_cal_web)

SwiftUI 앱 `dm_cal`을 **순수 정적 웹앱(PWA)** 으로 이식한 버전입니다.
서버나 데이터베이스가 필요 없고, 모든 계산은 브라우저 안에서 이뤄집니다.
저장은 iOS의 `@AppStorage` 대신 브라우저 `localStorage`를 사용합니다.

> **왜 이렇게 했나?** 기존 방식(Xcode로 빌드해 사이드로딩)은 1주~1년마다 인증서/프로비저닝 재서명이 필요했습니다.
> 웹앱은 한 번 호스팅해두면 인증서 갱신이 전혀 없고, 아이폰 Safari에서 **"홈 화면에 추가"** 하면
> 아이콘이 생기고 전체화면으로 네이티브 앱처럼 동작합니다.

## 기능

- **환율 계산**: `(금액A − 금액B) / 결제금액` = `¥/₩`. **저장** 버튼으로 환율을 보관.
  - **수동**: 직접 입력해서 계산 후 저장 (기존 앱과 동일)
  - **실시간**: `불러오기` 버튼으로 엔→원 환율을 자동 조회 후 저장
  - 둘 중 아무거나 골라 저장할 수 있고, 마지막에 저장한 값이 합산 계산에 쓰입니다.
- **합산 계산**: 숫자 키패드로 금액을 더하고, 저장된 환율을 곱해 원화 합계 표시.
  `999`로 끝나는 임계값 4개까지 필요한 엔(¥)도 계산.

## 파일 구조

```
dm_cal_web/
├── index.html              # 화면 3개(홈/환율/합산) 단일 페이지
├── styles.css              # 다크모드 대응
├── app.js                  # 모든 로직 + localStorage 저장
├── manifest.webmanifest    # PWA 설정(이름/아이콘/standalone)
├── sw.js                   # 서비스워커(오프라인 동작)
├── icons/                  # 앱 아이콘들
├── .nojekyll               # GitHub Pages가 파일을 그대로 서빙하도록
└── README.md
```

## 로컬에서 미리보기

```bash
cd dm_cal_web
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765 접속
```

## 배포: GitHub Pages (무료, PC 안 켜둬도 됨, 자동 HTTPS)

### 1) 저장소 만들기
1. https://github.com 가입(이미 있으면 생략)
2. 우상단 **+ → New repository**
3. 이름 예: `dm_cal_web` / **Public** 선택 (무료 Pages는 공개 저장소 필요, 이 앱엔 비밀정보 없음) → **Create**

### 2) 파일 올리기 (둘 중 하나)

**A. 명령어(git)** — 한 번 설정해두면 이후 업데이트가 `push` 한 번:
```bash
cd dm_cal_web
git init
git add .
git commit -m "The More web app"
git branch -M main
git remote add origin https://github.com/<본인아이디>/dm_cal_web.git
git push -u origin main
```

**B. 웹 업로드(git 몰라도 됨)**: 저장소 페이지 → **Add file → Upload files** →
`dm_cal_web` 안의 **내용물 전체**(index.html 등)를 드래그 → **Commit changes**.
> ⚠️ `dm_cal_web` 폴더째가 아니라 **그 안의 파일들**을 올려야 합니다.

### 3) Pages 켜기
저장소 **Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / `/ (root)` → Save**

1~2분 뒤 주소가 나옵니다:
```
https://<본인아이디>.github.io/dm_cal_web/
```
(상대경로로 작성돼 있어 이 하위경로에서 그대로 동작합니다.)

### 4) 아이폰 홈 화면에 추가
1. 아이폰 **Safari**로 위 주소 접속 (⚠️ Chrome 말고 Safari여야 PWA로 설치됨)
2. 하단 **공유 버튼** → **홈 화면에 추가**
3. 홈 화면 아이콘으로 실행 → 주소창 없는 전체화면 앱처럼 동작

## 앱 업데이트 방법

파일을 수정한 뒤:
- **git 방식**: `git add . && git commit -m "..." && git push` → 자동 재배포
- **웹 업로드 방식**: 바뀐 파일을 다시 Upload

> 📌 **중요**: 화면이 바로 안 바뀌면 `sw.js`의 `const CACHE = "themore-v1"`에서
> 숫자를 올려주세요(`v2`, `v3`…). 서비스워커가 캐시를 새로 받아 즉시 갱신됩니다.

## 참고

- **저장 데이터는 기기(브라우저)별로 보관**됩니다. 기존 iOS 앱과 동일하게 단일 기기용입니다.
  Safari 데이터를 완전히 지우면 저장값이 사라집니다.
- **실시간 환율**은 `open.er-api.com`(무료·키 불필요·CORS 허용)을 사용합니다.
  인터넷이 없으면 실시간 조회만 안 되고, 나머지(수동 환율·합산)는 오프라인에서도 동작합니다.
