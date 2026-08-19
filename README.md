# 비올까? ☂️

기상청 단기예보 조회서비스를 이용한 귀여운 강수 타임라인 웹페이지입니다.

## 기능

- 브라우저 현재 위치 → 기상청 격자(nx, ny) 자동 변환
- 초단기예보 `getUltraSrtFcst` + 단기예보 `getVilageFcst` 결합
- 앞으로 12시간 시간별 하늘/강수/기온 표시
- 비 시작 시각과 예상 그침 시각 요약
- 비가 12시간 뒤까지 계속되면 그침 시각을 억지로 추측하지 않고 안내
- CSS 구름 이동 + 비 애니메이션 + 수달 우산 캐릭터
- `prefers-reduced-motion` 대응

## 실행

1. 공공데이터포털에서 `기상청_단기예보 조회서비스` 활용 신청
2. `.env.example`을 복사해 `.env.local` 생성
3. 공공데이터포털에 표시되는 **Decoding 일반인증키** 입력

```env
KMA_SERVICE_KEY=발급받은_Decoding_일반인증키
```

4. Vercel CLI 실행

```bash
npm install
npm run dev
```

브라우저에서 Vercel이 출력한 로컬 주소로 접속합니다.

> 위치 정보 API는 HTTPS 또는 localhost 환경에서 동작합니다.

## Vercel 배포

Vercel 프로젝트의 Environment Variables에 아래 값을 등록합니다.

```text
KMA_SERVICE_KEY
```

그 다음 프로젝트를 배포하면 됩니다.

## 참고

- 초단기예보는 약 6시간 범위를 커버하므로, 이후 강수 종료를 보기 위해 단기예보를 이어 붙입니다.
- 강수 종료 시각은 `강수 → 비강수`로 처음 전환되는 시간대를 기준으로 안내합니다.
- 기상청 예보 특성상 실제 강수 시작/종료 시각과 차이가 날 수 있습니다.
