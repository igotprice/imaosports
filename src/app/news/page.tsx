export default function NewsPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header animate">
          <div className="section-badge">NEWS & QnA</div>
          <h1 className="section-title">NEWS &amp; QnA</h1>
          <p className="section-description">아이마오 클럽의 소식과 문의 게시판을 확인하세요.</p>
        </div>

        <div className="features-grid">
          <a className="feature-card animate" href="/news/gallery">
            <div className="feature-icon">🖼️</div>
            <h3 className="feature-title">클럽 갤러리</h3>
            <p className="feature-description">클럽 활동 사진과 현장 스케치를 확인하세요.</p>
          </a>
          <a className="feature-card animate" href="/news/notice">
            <div className="feature-icon">📌</div>
            <h3 className="feature-title">공지사항</h3>
            <p className="feature-description">공식 공지와 일정 안내를 모아드립니다.</p>
          </a>
          <a className="feature-card animate" href="/news/contact">
            <div className="feature-icon">💬</div>
            <h3 className="feature-title">아이마오 클럽 문의</h3>
            <p className="feature-description">궁금한 점을 남겨주시면 빠르게 답변드려요.</p>
          </a>
        </div>
      </div>
    </section>
  );
}
