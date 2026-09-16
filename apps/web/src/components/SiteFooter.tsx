function XIcon() {
  return (
    <svg
      className="fused-footer-x"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.727-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="fused-footer">
      <div className="fused-wrap fused-footer-inner">
        <span className="fused-footer-brand">FUSED AI</span>
        <nav className="fused-footer-links" aria-label="Footer">
          <a
            href="/fused-ai-whitepaper.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            Whitepaper
          </a>
          <a href="#">Documentation</a>
          <a
            href="https://x.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
            title="X"
          >
            <XIcon />
          </a>
        </nav>
      </div>
    </footer>
  );
}
