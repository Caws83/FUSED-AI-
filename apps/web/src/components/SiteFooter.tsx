import { ThemeSwitch } from "./ThemeSwitch.tsx";

export function SiteFooter({ showStatus = false }: { showStatus?: boolean }) {
  return (
    <footer className="fused-footer">
      <div className="fused-wrap fused-footer-inner">
        <span className="fused-footer-brand">FUSED AI</span>
        <div className="fused-footer-tools">
          <ThemeSwitch />
          <nav className="fused-footer-links" aria-label="Footer">
            <a href="/roadmap">Roadmap</a>
            <a href="/docs">Docs</a>
            <a href="/fused-ai-whitepaper.pdf" target="_blank" rel="noopener noreferrer">
              Whitepaper
            </a>
            {showStatus ? <a href="/status">Status</a> : null}
          </nav>
        </div>
      </div>
    </footer>
  );
}
