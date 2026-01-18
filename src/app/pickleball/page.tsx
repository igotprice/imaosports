export default function PickleballPage() {
  return (
    <>
      <section className="hero hero--pickle">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">IMAO · PICKLEBALL GUIDE</div>
            <h1 className="hero-title">아이마오 피클볼 안내서</h1>
            <p className="hero-subtitle">
              피클볼은 테니스·배드민턴·탁구의 <br />장점을 결합한 라켓 스포츠로,<br />
              1965년 미국에서 시작해 전 세계로 확산되었습니다.<br /><br />
              국내에는 2016년 연세대학교 허진무 교수가 연세피클볼클럽을 창립.<br />
              수업으로 도입하며 본격 확산되었고,<br />
              2018년 대한피클볼협회가 창립되며 대중 스포츠로 자리잡고 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">TOC</div>
            <h2 className="section-title">원하시는 주제를 누르시면 이동합니다.</h2>
          </div>
          <div className="quick-nav">
            {[
              ["피클볼의 매력", "#intro"],
              ["코트 구성 · 라인", "#court"],
              ["특별한 규칙", "#rules"],
              ["점수 계산 · 형식", "#scoring"],
              ["서브 기본 · 복식 순서", "#serve"],
              ["핵심 전략: 키친", "#kitchen"],
              ["기본 기술", "#skills"],
              ["입문 가이드", "#starter"],
              ["에티켓 · 안전", "#etiquette"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="quick-nav-item">{label}</a>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="intro">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">피클볼의 매력</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-item-icon">🏁</span>
                <h3 className="feature-item-title">누구나 빠르게</h3>
                <p className="feature-item-text">
                  규칙이 간단하고 공 속도가 빠르지 않아<br />
                  어린이부터 노년층까지 쉽게 배우고 즐길 수 있습니다. <br />
                  처음 접해도 짧은 시간에 기본 규칙을 익히기 좋습니다.
                </p>
              </div>
              <div className="feature-item">
                <span className="feature-item-icon">🤝</span>
                <h3 className="feature-item-title">작은 코트, 큰 소통</h3>
                <p className="feature-item-text">
                  작은 코트·복식 중심 운영으로 <br />
                  팀워크와 교류가 활발합니다. <br />
                  친목 도모와 새로운 만남에 특히 유리합니다.
                </p>
              </div>
              <div className="feature-item">
                <span className="feature-item-icon">💪</span>
                <h3 className="feature-item-title">부담은 적고 효과는 충분</h3>
                <p className="feature-item-text">
                  테니스보다 덜 격렬하면서도 유산소 운동 효과가 좋아<br />
                  관절 부담이 적고 모든 연령대의 건강 관리에 적합합니다.
                </p>
              </div>
            </div>
            <div className="highlight-box">
              피클볼은 진입 장벽이 낮으면서도 <br />전략적인 깊이가 있습니다. <br /><br />그렇기에 초보자부터 전문가까지 <br />모두에게 재미있는 스포츠입니다.
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="court">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">코트 구성 · 라인</h2>
            <p className="card-subtitle">코트 구조를 알면 규칙과 전략이 선명해집니다.</p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th scope="col">영역</th>
                    <th scope="col">설명</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="text-gradient">코트 크기</span></td>
                    <td>가로 6.1m, 세로 13.4m로<br />(복식/단식 동일) <br />테니스 코트의 약 1/4 크기입니다.<br />네트 중앙 높이는 약 86cm입니다.</td>
                  </tr>
                  <tr>
                    <td><span className="text-gradient">키친(NVZ)</span></td>
                    <td>네트 양쪽으로 2.13m(7피트) 떨어진 <br />‘논발리존'<br />이 영역에서는 발리(공이 바운드되기 전 공중에서 치는 샷)가 금지됩니다.</td>
                  </tr>
                  <tr>
                    <td><span className="text-gradient">서비스 박스</span></td>
                    <td>코트의 중앙선을 기준으로 <br />각 팀의 코트가 좌·우로 나뉩니다.<br />서브는 항상 대각선 서비스 박스로 들어가야 합니다.</td>
                  </tr>
                  <tr>
                    <td><span className="text-gradient">라인 판정</span></td>
                    <td>코트의가장뒤쪽경계선을베이스라인, 양옆경계선을사이드라인이라고합니다. <br />공이 라인 안에 떨어지면 인(In), <br />밖에 떨어지면 아웃(Out)입니다.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="rules">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">특별한 규칙</h2>
            <p className="card-subtitle">핵심 규칙을 한눈에 확인하세요.</p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">설명</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="text-gradient">언더핸드 서브</span></td>
                    <td>반드시 허리 아래에서 언더핸드로 서브를 넣어야 합니다</td>
                  </tr>
                  <tr>
                    <td><span className="text-gradient">투 바운스 룰</span></td>
                    <td>서브된 공은 상대편 코트에서 한 번, <br />리턴된 공은 다시 서브한 팀의 코트에서 한 번 더 바운드되어야 합니다.</td>
                  </tr>
                  <tr>
                    <td><span className="text-gradient">키친(NVZ) 규칙</span></td>
                    <td>키친(논발리 존)안에 발을 딛고 있는 상태에서는 발리를 할 수 없습니다. 키친 안으로 들어온 공이 바운드 된 후에는 칠 수 있습니다.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="tip-box">
              <strong>TIP</strong> <br />
              <br />점프 볼리 후 착지가 키친/라인이면<br /> 반칙으로 간주됩니다. <br />라인 접촉도 포함되니 주의하세요.
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="scoring">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">점수 계산 · 경기 형식</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <h3 className="feature-item-title">기본</h3>
                <ul className="info-list">
                  <li>서브 팀만 득점합니다. <br />
                  리시브 팀이 랠리에서 이기면 점수가 아니라 서브권을 가져옵니다.</li>
                  <li>일반적으로 <strong>11점 선취에 2점 차</strong> 승리 조건을 사용합니다<br />(대회에 따라 15/21점제 등 변형 존재).</li>
                </ul>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">점수 콜(복식)</h3>
                <ul className="info-list">
                  <li>호출 순서: <strong><br />서버팀 점수 → <br />리시브팀 점수 → <br />서버 번호(1 또는 2)</strong></li>
                  <li>예시: <strong>3 – 2 – 1</strong></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="serve">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">서브 기본 · 복식 서브 순서</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <h3 className="feature-item-title">서브 기본</h3>
                <ul className="info-list">
                  <li>언더핸드로 허리 아래 임팩트, <br />대각선 서비스 박스에 <strong>노바운스로 정확히</strong> 투입</li>
                  <li>서브가 네트를 맞고 서비스 박스에 들어가면 <strong><br />다시 서브(렛)</strong></li>
                </ul>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">복식 서브 순서</h3>
                <ul className="info-list">
                  <li>게임 시작 시 첫 번째 서브 팀은 <strong>한 명만</strong> 서브</li>
                  <li>이후부터는 한 팀이 <strong>두 번의 서브 기회</strong>(두 선수 각각)를 가집니다</li>
                  <li>첫 번째 선수가 폴트하면 같은 팀의 두 번째 선수에게 서브권이 넘어갑니다</li>
                  <li>두 번째 선수마저 폴트하면 상대 팀에게 서브권이 넘어갑니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="kitchen">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">핵심 전략: 키친(Non-Volley Zone) 활용</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <h3 className="feature-item-title">라인 컨트롤</h3>
                <p className="feature-item-text">
                  숙련된 선수는 키친 라인 바로 뒤에서 <br />경기 흐름을 주도합니다.<br />
                  이 위치는 공격과 수비 모두에 유리합니다.<br />
                  단, 발이 NVZ 안/라인에 닿지 않도록 주의합니다.
                </p>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">딩크 샷</h3>
                <p className="feature-item-text">
                  네트 바로 너머로 부드럽게 보내는 기술<br />
                  상대의 강한 공격을 어렵게 만들고, <br />
                  키친 라인에서 유리한 위치를 유지합니다.<br />
                  손목 스냅보다 팔 전체로 컨트롤하세요.
                </p>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">인내심</h3>
                <p className="feature-item-text">
                  ‘딩크 배틀’에서는 서두르지 말고 <br />
                  안정적인 샷으로 상대의 실수를 유도하며<br />
                  적절한 공격 기회를 기다리는 태도가 중요합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="skills">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">기술</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <h3 className="feature-item-title">기술 개요</h3>
                <ul className="info-list">
                  <li>서브: 언더핸드, 정확성 우선</li>
                  <li>리턴: 깊고 길게 보내 상대 전진 억제</li>
                  <li>딩크: 키친 근처 낮고 부드럽게</li>
                  <li>스매시: 높이 뜬 공 처리(키친 규칙 유의)</li>
                  <li>드롭: 후방에서 NVZ 짧게 떨어뜨리며 전진 연결</li>
                </ul>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">연습 팁</h3>
                <ul className="info-list">
                  <li>정확성 → 파워 순서로 습득(벽 타구 연습 효과적)</li>
                  <li>투 바운스·키친 규칙을 상정한 상황 드릴로 효율 UP</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="starter">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">입문</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <h3 className="feature-item-title">단계별 시작</h3>
                <ul className="info-list">
                  <li>장비 준비(패들·볼)<br />초보는 7–8.5oz(약 199–241g) 권장<br /> 실내(26홀)/실외(40홀) 구분</li>
                  <li>기본 규칙(투 바운스·키친·점수) 숙지</li>
                  <li>기술 연습(서브·리턴·딩크)부터 차근차근</li>
                  <li>지역 커뮤니티·클럽 참여로 실전 감각 축적</li>
                </ul>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">장비 체크리스트</h3>
                <ul className="info-list">
                  <li><strong>패들</strong>: 무게·밸런스·페이스(스핀/컨트롤) 취향에 맞게</li>
                  <li><strong>볼</strong>: 실내/실외 볼(홀 수·경도) 구분, 환경에 맞춰 사용</li>
                  <li><strong>슈즈</strong>: 논마킹 바닥 권장, 측면 지지·접지 중요</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="etiquette">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">에티켓</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <h3 className="feature-item-title">매너</h3>
                <ul className="info-list">
                  <li>정직한 콜(인/아웃)과 명확한 스코어 호출 습관</li>
                  <li>상대 존중·과도한 세리머니 지양·게임 후 인사</li>
                  <li>코트가 붐빌 땐 순서 준수·적정 시간 사용</li>
                </ul>
              </div>
              <div className="feature-item">
                <h3 className="feature-item-title">안전 수칙</h3>
                <ul className="info-list">
                  <li>미끄럼 방지 코트화·워밍업·수분 보충 필수</li>
                  <li>무리한 점프·급격한 동작 지양, 코트 주변 위험물 제거</li>
                  <li>다른 코트 공 유입 시 “공!” 외쳐 주변 주의</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="cta">
        <div className="container">
          <div className="content-card">
            <h2 className="card-title">IMAO CLUB과 함께 시작하세요</h2>
            <p className="card-subtitle">프로그램·대회·커뮤니티 — 한 번의 가입으로 모두 연결됩니다.</p>
            <div className="feature-grid">
              <a className="feature-item" href="/board/아이마오스포츠-FAQ/3/" style={{ textDecoration: "none" }}>
                <h3 className="feature-item-title">관련 FAQ</h3>
                <p className="feature-item-text">친절한 답변 약속드립니다</p>
              </a>
              <a className="feature-item" href="/board/피클볼-소식/2/" style={{ textDecoration: "none" }}>
                <h3 className="feature-item-title">대회/이벤트</h3>
                <p className="feature-item-text">피클복 소식을 만나보세요</p>
              </a>
              <a className="feature-item" href="https://imaosports.kr/" style={{ textDecoration: "none" }}>
                <h3 className="feature-item-title">공식 장비</h3>
                <p className="feature-item-text">인증된 제품 라인업을 만나보세요</p>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
