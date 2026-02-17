import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const scrollToId = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bw-home">
      <header className="bw-nav">
        <div className="bw-nav-inner">
          <a
            className="bw-brand"
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="bw-mark" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 2.5l3.3 6.9 7.5 1.1-5.4 5.2 1.3 7.4L14 19.6 7.3 23.1l1.3-7.4-5.4-5.2 7.5-1.1L14 2.5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="bw-brand-text">
              <span className="bw-brand-name">BudgetWonders</span>
              <span className="bw-brand-sub">Simple tools. Big wins.</span>
            </span>
          </a>

          <nav className="bw-links" aria-label="Primary">
            <Link to="/certifyly">Certifyly</Link>
            <a
              href="#wonders"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("wonders");
              }}
            >
              Wonders
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("pricing");
              }}
            >
              Pricing
            </a>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("contact");
              }}
            >
              Contact
            </a>
          </nav>

          <div className="bw-actions">
            <Link className="bw-btn bw-btn-primary" to="/certifyly">
              Try Certifyly
            </Link>
          </div>
        </div>
      </header>

      <main className="bw-main">
        <section className="bw-hero" id="home">
          <div className="bw-hero-inner">
            <div className="bw-hero-copy">
              <div className="bw-pill">
                Now live: <strong>Certifyly</strong>
              </div>
              <h1>Beautiful certificates in minutes — not hours.</h1>
              <p>
                BudgetWonders builds small, focused “wonders” that save time and
                look premium. The first wonder is <strong>Certifyly</strong>:
                bulk certificate generation from a template + CSV.
              </p>

              <div className="bw-cta">
                <Link className="bw-btn bw-btn-primary bw-btn-lg" to="/certifyly">
                  Open Certifyly
                </Link>
                <a
                  className="bw-btn bw-btn-ghost bw-btn-lg"
                  href="#wonders"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId("wonders");
                  }}
                >
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
                <Link className="bw-btn bw-btn-primary bw-btn-wide" to="/certifyly">
                  Generate Certificates
                </Link>
              </div>
              <div className="bw-card-foot">
                <span>Fast • Offline-friendly • Export-ready</span>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits / Conversion */}
        <section className="bw-section bw-benefits">
          <div className="bw-section-inner">
            <h2>Why Certifyly</h2>
            <p className="bw-section-sub">
              Built for schools, clubs, coaches, and small businesses who need quality output fast.
            </p>

            <div className="bw-grid bw-grid-3">
              <article className="bw-tile">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">⚡</div>
                  <div>
                    <div className="bw-tile-title">Bulk generation</div>
                    <div className="bw-tile-sub">Hundreds in minutes</div>
                  </div>
                </div>
                <p className="bw-muted">
                  Upload a CSV and export PDFs/PNGs in one go — perfect for classes and events.
                </p>
              </article>

              <article className="bw-tile">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">🎨</div>
                  <div>
                    <div className="bw-tile-title">Your own design</div>
                    <div className="bw-tile-sub">Use your brand</div>
                  </div>
                </div>
                <p className="bw-muted">
                  Upload your template and place names/titles exactly where you want.
                </p>
              </article>

              <article className="bw-tile">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">📦</div>
                  <div>
                    <div className="bw-tile-title">Export-ready</div>
                    <div className="bw-tile-sub">ZIP downloads</div>
                  </div>
                </div>
                <p className="bw-muted">
                  Download as a ZIP and send instantly to parents, students, or team members.
                </p>
              </article>
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
              <Link to="/certifyly" className="bw-tile bw-tile-accent bw-tile-link">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 6h16v12H4V6z" stroke="currentColor" strokeWidth="2" />
                      <path
                        d="M7 9h10M7 12h6M7 15h8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
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
              </Link>

              <article className="bw-tile" aria-label="Coming soon">
                <div className="bw-tile-head">
                  <div className="bw-tile-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2v20M2 12h20"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
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
                      <path
                        d="M4 7h16M4 12h16M4 17h16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
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

        {/* Pricing */}
        <section className="bw-section" id="pricing">
          <div className="bw-section-inner">
            <h2>Pricing</h2>
            <p className="bw-section-sub">Start free. Upgrade when you’re ready.</p>

            <div className="bw-grid bw-pricing">
              <article className="bw-price-card">
                <div className="bw-price-head">
                  <h3>Free</h3>
                  <div className="bw-price">€0</div>
                  <div className="bw-price-sub">Try it out</div>
                </div>
                <ul className="bw-bullets">
                  <li>Basic templates</li>
                  <li>Upload your own template</li>
                  <li>Export PNG</li>
                </ul>
                <Link className="bw-btn bw-btn-ghost bw-btn-wide" to="/certifyly">
                  Use Free
                </Link>
              </article>

              <article className="bw-price-card bw-price-popular">
                <div className="bw-pill">Most popular</div>
                <div className="bw-price-head">
                  <h3>Pro</h3>
                  <div className="bw-price">€9 / month</div>
                  <div className="bw-price-sub">For schools & clubs</div>
                </div>
                <ul className="bw-bullets">
                  <li>Unlimited certificates</li>
                  <li>PDF export</li>
                  <li>ZIP exports</li>
                  <li>Priority template packs</li>
                </ul>
                <button className="bw-btn bw-btn-primary bw-btn-wide" type="button" disabled>
                  Coming soon
                </button>
              </article>

              <article className="bw-price-card">
                <div className="bw-price-head">
                  <h3>Teams</h3>
                  <div className="bw-price">Custom</div>
                  <div className="bw-price-sub">For organizations</div>
                </div>
                <ul className="bw-bullets">
                  <li>Custom branding</li>
                  <li>Template library setup</li>
                  <li>Support & onboarding</li>
                </ul>
                <a className="bw-btn bw-btn-ghost bw-btn-wide" href="mailto:hello@budgetwonders.eu">
                  Contact
                </a>
              </article>
            </div>
          </div>
        </section>

        {/* Email capture */}
        <section className="bw-section bw-section-tight bw-email-cta" id="early-access">
          <div className="bw-section-inner">
            <h2>Get early access</h2>
            <p className="bw-section-sub">
              Be first to unlock Pro features and new template packs.
            </p>

            {/* Replace action with your Brevo/Mailchimp form action when you have it */}
            <form
              className="bw-email-form"
              onSubmit={(e) => {
                e.preventDefault();
                alert("Hook this form to Brevo/Mailchimp when ready.");
              }}
            >
              <input
                className="bw-input"
                type="email"
                placeholder="you@example.com"
                required
              />
              <button className="bw-btn bw-btn-primary" type="submit">
                Join waitlist
              </button>
            </form>

            <div className="bw-muted bw-small">
              No spam. Unsubscribe anytime.
            </div>
          </div>
        </section>

        <section className="bw-section bw-section-tight" id="contact">
          <div className="bw-section-inner">
            <h2>Contact</h2>
            <p className="bw-section-sub">
              For feedback, partnerships, or custom “wonders”, email:
              <span className="bw-email"> hello@budgetwonders.eu</span>
              <span className="bw-hint"> (set up this mailbox when ready)</span>
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
            <Link to="/certifyly">Certifyly</Link>
            <span className="bw-footer-dot">•</span>
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Back to top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
