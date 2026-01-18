export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">대한민국 피클볼의 기준</div>
            <h1 className="hero-title">
              <span className="text-gradient">대한민국 피클볼</span>,<br />
              IMAO가 기준이 됩니다.
            </h1>
            <p className="hero-subtitle">
              연구부터 설계, 제작, 그리고 선수 육성까지.<br />
              피클볼의 현재와 미래를 함께 만들어갑니다.
            </p>
            <div className="hero-buttons">
              <a href="https://imaosports.kr/" className="btn btn-primary" target="_blank" rel="noreferrer">
                제품 보러가기
              </a>
              <a href="/member/login.html" className="btn btn-outline">
                IMAO 클럽 가입
              </a>
              <a href="/board/%ED%94%BC%ED%81%B4%EB%B3%BC-%EC%86%8C%EC%8B%9D/2/" className="btn btn-outline">
                피클볼 소식
              </a>
            </div>
            <div className="badge-row">
              <div className="badge-item">
                <strong>ONE-STOP</strong> 연구→설계→제작→테스트→출시
              </div>
              <div className="badge-item">
                <strong>USAPA</strong> 국제 규격 기반 설계
              </div>
              <div className="badge-item">
                <strong>IMAO CLUB</strong> 커뮤니티 &amp; 대회 운영
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="why">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">WHY IMAO</div>
            <h2 className="section-title">IMAO만의 완벽한 차별성</h2>
            <p className="section-description">
              대한민국 최초의 원스톱 시스템으로,<br />
              코트에서 체감되는 퍼포먼스를 만듭니다.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔬</div>
              <h3 className="feature-title">전문 연구 시스템 통한 디자인 설계</h3>
              <ul className="feature-list">
                <li>입문자부터 프로까지 맞춤 설계</li>
                <li>개인별 스킬 강화 전용 아이템 설계</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🏅</div>
              <h3 className="feature-title">USAPA 국제 규격 인증</h3>
              <ul className="feature-list">
                <li>모든 제품 USAPA 규격 준수</li>
                <li>국제 공식 대회 사용</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3 className="feature-title">직접 생산 체계</h3>
              <ul className="feature-list">
                <li>모든 제품 자체 생산 및 납품</li>
                <li>고품질 합리적인 가격</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <h3 className="feature-title">철저한 3STEP 검수 시스템</h3>
              <ul className="feature-list">
                <li>모든 제품 기능 테스트 및 검수</li>
                <li>대량 납품에도 균일한 퀄리티 보장</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="brand-vision">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">BRAND VISION</div>
            <h2 className="section-title">브랜드 정체성 &amp; 비전</h2>
            <p className="section-description">
              IMAO는 단순히 스포츠 용품을 만드는 브랜드가 아닙니다.<br />
              ‘경기력’과 ‘문화’를 함께 설계합니다.
            </p>
          </div>

          <div className="content-card">
            <p className="card-subtitle" style={{ textAlign: "center" }}>
              스포츠 정신과 열정을 담아, <br />모두가 함께 즐기고 성장할 수 있는 <br />피클볼 문화를 만들어갑니다.
              <br /><br />
              연구와 열정으로 만든 제품, <br />커뮤니티와 함께 성장하는 브랜드,<br /> 그 중심에 IMAO가 있습니다.
            </p>

            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-item-icon">👥</span>
                <h3 className="feature-item-title">IMAO 클럽 운영</h3>
                <p className="feature-item-text">
                  전국 네트워크로 회원을 연결하고, <br />커뮤니티를 확장합니다.
                  <br />
                  <br />입문부터 프로까지 레벨별 프로그램을 제공합니다.
                </p>
              </div>
              <div className="feature-item">
                <span className="feature-item-icon">🏆</span>
                <h3 className="feature-item-title">피클볼 대회 주최 &amp; 지원</h3>
                <p className="feature-item-text">
                  정기 리그/토너먼트를 개최하고, <br />공식 규격 장비를 지원합니다.
                  <br /><br />
                  선수들이 성장할 수 있도록 최대한으로 노력합니다..
                </p>
              </div>
              <div className="feature-item">
                <span className="feature-item-icon">🌟</span>
                <h3 className="feature-item-title">선수 육성 &amp; 미래 투자</h3>
                <p className="feature-item-text">
                  유망주 발굴과 체계적 훈련 지원으로 <br />선수 생태계를 구축합니다.
                  <br /><br />
                  대한민국 피클볼의 인재 허브로 성장합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <h2 className="cta-title">IMAO가 만든 차이를 직접 경험해보세요.</h2>
          <p className="cta-description">피클볼의 새로운 기준, 바로 여기서 시작됩니다.</p>
          <div className="cta-buttons">
            <a href="https://imaosports.kr/" className="btn btn-primary" target="_blank" rel="noreferrer">
              제품 보러가기 →
            </a>
            <a href="/member/login.html" className="btn btn-outline">
              IMAO 클럽 가입 →
            </a>
            <a href="/board/%ED%94%BC%ED%81%B4%EB%B3%BC-%EC%86%8C%EC%8B%9D/2/" className="btn btn-outline">
              피클볼 소식 →
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="club-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">IMAO CLUB</div>
            <h2 className="section-title">아이마오 클럽, <br /><br />함께 성장하는 피클볼 커뮤니티</h2>
            <p className="section-description">
             <br /> IMAO CLUB은 전국 네트워크 기반으로 운영되며,<br /> 레벨별 프로그램, 정기 리그, 대회 개최 <br />그리고 선수 육성까지 이어지는
              <br />
              <strong>대한민국 대표 피클볼 플랫폼</strong>입니다.
            </p><br />
            <p className="section-description">
              <strong>가입 한 번으로 아이마오 클럽의 모든 혜택을 받아보세요.</strong>
            </p>
          </div>

          <div className="content-card">
            <p className="card-subtitle" style={{ textAlign: "center" }}>
              <strong>초보자에게는 ‘처음이 즐거운 경험’을, <br />선수에게는 ‘도전과 성취의 무대’를 제공합니다.</strong>
              <br /><br />
              IMAO CLUB에 가입하는 순간, <br />대한민국 피클볼 성장의 한가운데에 서게 됩니다.
            </p>

            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-item-icon">📅</span>
                <h3 className="feature-item-title">정기 프로그램</h3>
                <ul className="info-list">
                  <li>입문자 강습, 레벨별 드릴 · 스크림 · 코칭</li>
                  <li>매월 2~4회 정기 진행, 맞춤형 커리큘럼</li>
                  <li><strong>15세~시니어까지 전 연령 참여</strong></li>
                </ul>
              </div>
              <div className="feature-item">
                <span className="feature-item-icon">🏟️</span>
                <h3 className="feature-item-title">리그 &amp; 토너먼트</h3>
                <ul className="info-list">
                  <li>월간/분기별 공식 리그 및 토너먼트 개최</li>
                  <li>IMAO 운영·심판 시스템으로 공정한 경기</li>
                  <li>공식 규격 장비 100% 지원</li>
                </ul>
              </div>
              <div className="feature-item">
                <span className="feature-item-icon">🎯</span>
                <h3 className="feature-item-title">선수 육성</h3>
                <ul className="info-list">
                  <li>유망주 발굴 → 맞춤 훈련 → 전국 대회 파견</li>
                  <li>프로 코치진과 함께 성장하는 엘리트 과정</li>
                  <li><strong>피클볼 국가대표 인재 허브</strong></li>
                </ul>
              </div>
            </div>

            <div className="highlight-box" style={{ marginTop: "2.5rem" }}>
              <h3 className="benefit-title">IMAO CLUB만의 혜택</h3>
              <ul className="benefit-list">
                <li>전국 단위 네트워크와 교류, 지역 클럽 연계</li>
                <li>클럽 회원 전용 온라인 커뮤니티 &amp; 일정 공유</li>
                <li>참가비 할인 및 공식 용품 특별 제공</li>
                <li>SNS 홍보 지원</li>
                <li>공식 활동 인증서 발급</li>
              </ul>
            </div>

            <div className="cta-buttons" style={{ marginTop: "2.5rem" }}>
              <a href="/member/login.html" className="btn btn-primary">
                클럽 가입 →
              </a>
              <a href="/board/%ED%94%BC%ED%81%B4%EB%B3%BC-%EC%86%8C%EC%8B%9D/2/" className="btn btn-outline">
                대회/소식 →
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
