import React from "react";

export default function HomePage({ onOpenCertifyly }) {
  return (
    <div className="bw-home">
      <header className="bw-nav">
        <div className="bw-nav-inner">
          <a className="bw-brand" href="#home" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="bw-mark" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2.5l3.3 6.9 7.5 1.1-5.4 5.2 1.3 7.4L14 19.6 7.3 23.1l1.3-7.4-5.4-5.2 7.5-1.1L14 2.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="bw-brand-text">
              <span className="bw-brand-name">BudgetWonders</span>
              <span className="bw-brand-sub">Simple tools. Big wins.</span>
            </span>
          </a>

          <nav className="bw-links" aria-label="Primary">
            <a href="#certifyly" onClick={(e) => { e.preventDefault(); onOpenCertifyly(); }}>Certifyly</a>
            <a href="#wonders" onClick={(e) => { e.preventDefault(); document.getElementById("wonders")?.scrollIntoView({ behavior: "smooth" }); }}>Wonders</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }}>Contact</a>
          </nav>

          <div className="bw-actions">
            <button className="bw-btn bw-btn-primary" onClick={onOpenCertifyly}>
              Try Certifyly
            </button>
          </div>
        </div>
      </header>

      <main className="bw-main">
        <section className="bw-hero" id="home">
          <div className="bw-hero-inner">
            <div className="bw-hero-copy">
              <div className="bw-pill">Now live: <strong>Certifyly</strong></div>
              <h1>Beautiful certificates in minutes — not hours.</h1>
              <p>
                BudgetWonders builds small, focused “wonders” that save time and look premium.
                The first wonder is <strong>Certifyly</strong>: bulk certificate generation from a template + CSV.
              </p>
              <div className="bw-cta">
                <button className="bw-btn bw-btn-primary bw-btn-lg" onClick={onOpenCertifyly}>
                  Open Certifyly
                </button>
                <a className="bw-btn bw-btn-ghost bw-btn-lg" href="#wonders" onClick={(e) => { e.preventDefault(); document.getElementById("wonders")?.scrollIntoView({ behavior: "smooth" }); }}>
                  See what’s next
                </a>
              </div>

              <div className="bw-metrics" aria-label="Highlights">
                <div className="bw-metric">
                  <div className="bw-metric-title">CSV → PDF/PNG</div>
                  <div className="bw-metric-sub">Bulk export in one click</div>
                </div>
                <div className="bw-metric">
                  <div className="bw-metric-title">Template gallery</div>
                  <div className="bw-metric-sub">Pick by thumbnail</div>
                </div>
                <div className="bw-metric">
                  <div className="bw-metric-title">Upload yours</div>
                  <div className="bw-metric-sub">Bring your own design</div>
                </div>
              </div>
            </div>

            <div className="bw-hero-card" aria-label="Certifyly preview">
              <div className="bw-card-top">
                <div className="bw-card-dot" />
                <div className="bw-card-dot" />
                <div className="bw-card-dot" />
                <div className="bw-card-title">Certifyly</div>
              </div>
              <div className="bw-card-body">
                <div className="bw-mock">
                  <div className="bw-mock-thumb" />
                  <div className="bw-mock-lines">
                    <div className="bw-line bw-line-lg" />
                    <div className="bw-line" />
                    <div className="bw-line" />
                    <div className="bw-line bw-line-sm" />
                  </div>
                </div>
                <div className="bw-mock-certs">
                  <div className="bw-cert" />
                  <div className="bw-cert" />
                  <div className="bw-cert" />
                </div>
                <button className="bw-btn bw-btn-primary bw-btn-wide" onClick={onOpenCertifyly}>
                  Generate Certificates
                </button>
              </div>
              <div className="bw-card-foot">
                <span>Fast • Offline-friendly • Export-ready</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bw-section" id="wonders">
          <div className="bw-section-inner">
            <h2>Wonders</h2>
            <p className="bw-section-sub">
              A growing toolbox for creators, schools, coaches, and small businesses.
            </p>

            <div className="bw-grid">
              <article className="bw-tile bw-tile-accent" role="button" tabIndex={0}
                onClick={onOpenCertifyly}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenCertifyly(); }}>
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 6h16v12H4V6z" stroke="currentColor" strokeWidth="2" />
                      <path d="M7 9h10M7 12h6M7 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="bw-tile-title">Certifyly</div>
                    <div className="bw-tile-sub">Certificate generator</div>
                  </div>
                </div>
                <ul className="bw-bullets">
                  <li>Choose a template by thumbnail</li>
                  <li>Upload your own template</li>
                  <li>Export PDF + PNG ZIP</li>
                </ul>
                <div className="bw-tile-cta">
                  <span>Open →</span>
                </div>
              </article>

              <article className="bw-tile" aria-label="Coming soon">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="bw-tile-title">Next Wonder</div>
                    <div className="bw-tile-sub">Coming soon</div>
                  </div>
                </div>
                <p className="bw-muted">
                  Want a specific “wonder” for your workflow? Tell me what you’d like automated.
                </p>
                <div className="bw-tile-cta bw-muted">
                  <span>In progress</span>
                </div>
              </article>

              <article className="bw-tile" aria-label="Coming soon">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="bw-tile-title">Template Packs</div>
                    <div className="bw-tile-sub">For schools & clubs</div>
                  </div>
                </div>
                <p className="bw-muted">
                  Curated, themed templates: kids, football, ballet, and more.
                </p>
                <div className="bw-tile-cta bw-muted">
                  <span>Planned</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="bw-section bw-section-tight" id="contact">
          <div className="bw-section-inner">
            <h2>Contact</h2>
            <p className="bw-section-sub">
              For feedback, partnerships, or custom “wonders”, email:
              <span className="bw-email"> hello@budgetwonders.eu</span>
              <span className="bw-hint">(set up this mailbox when ready)</span>
            </p>
          </div>
        </section>
      </main>

      <footer className="bw-footer">
        <div className="bw-footer-inner">
          <div className="bw-footer-left">
            <span className="bw-footer-brand">BudgetWonders.eu</span>
            <span className="bw-footer-dot">•</span>
            <span className="bw-muted">© {new Date().getFullYear()}</span>
          </div>
          <div className="bw-footer-right">
            <a href="#certifyly" onClick={(e) => { e.preventDefault(); onOpenCertifyly(); }}>Certifyly</a>
            <span className="bw-footer-dot">•</span>
            <a href="#home" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
