import { Card, SectionHeader } from "@fused-ai/ui";

export const dynamic = "force-dynamic";

const TOC = [
  { href: "#overview", label: "Overview" },
  { href: "#fuse", label: "Fuse a post" },
  { href: "#launch", label: "Launch" },
  { href: "#trade", label: "Trade" },
  { href: "#graduate", label: "Graduate" },
  { href: "#rewards", label: "Rewards" },
  { href: "#networks", label: "Networks" },
  { href: "#community", label: "Community" },
] as const;

export default function DocsPage() {
  return (
    <main className="fused-section">
      <div className="fused-wrap fused-docs">
        <SectionHeader kicker="Documentation" title="How FUSED works." />
        <p style={{ color: "var(--fused-muted)", maxWidth: 680, margin: 0 }}>
          FUSED turns a post into a token. You review the draft. Your wallet signs. AI never holds keys.
        </p>

        <Card>
          <nav className="fused-docs-toc" aria-label="Documentation">
            {TOC.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </Card>

        <Card id="overview" className="fused-docs-section">
          <p className="fused-kicker">Overview</p>
          <h3>Launch a token from a post</h3>
          <p>
            One post. One click. One token. Paste a post, let FUSED draft a name, ticker, description, and logo, then
            launch on a bonding curve. Traders buy and sell on the curve. When the token graduates, liquidity moves to
            Uniswap v4 and stays locked.
          </p>
          <ul>
            <li>
              <strong>Fuse</strong> — paste a post and generate a launch draft.
            </li>
            <li>
              <strong>Curve</strong> — the token trades on the FUSED bonding curve.
            </li>
            <li>
              <strong>Trade</strong> — live buys and sells from the token page.
            </li>
            <li>
              <strong>Graduate</strong> — locked Uniswap v4 liquidity after the curve fills.
            </li>
          </ul>
        </Card>

        <Card id="fuse" className="fused-docs-section">
          <p className="fused-kicker">Fuse a post</p>
          <h3>Paste text. Review the draft.</h3>
          <p>
            From the home page or <a href="/launch">Launch</a>, paste a tweet or post. FUSED proposes a name, ticker,
            description, and logo. You can edit every field. Nothing goes onchain until you click Launch Token.
          </p>
          <p>
            If the paste includes an X link, the token page can show that origin post. The token creator is still the
            wallet that signs, not necessarily the original author.
          </p>
        </Card>

        <Card id="launch" className="fused-docs-section">
          <p className="fused-kicker">Launch</p>
          <h3>Your wallet creates the token</h3>
          <p>
            Connect a wallet, pick the network, and confirm the transaction. You can also create a token manually
            without fusing a post. An optional creator buy sends quote through the same bonding curve as everyone else.
          </p>
          <p>AI drafts. You decide. Only your wallet can sign the launch.</p>
        </Card>

        <Card id="trade" className="fused-docs-section">
          <p className="fused-kicker">Trade</p>
          <h3>Buy and sell from the token page</h3>
          <p>
            Open a token from Explore or the home boards. The same Buy / Sell panel works on the curve and after
            graduation. You set size and slippage. The trade only happens after your wallet confirms.
          </p>
          <p>
            Curve trades take a 1% fee. 30% of that fee goes to the wallet that launched the token. 70% goes to the
            FUSED treasury. Launchers claim curve rewards on the <a href="/rewards">Rewards</a> page.
          </p>
        </Card>

        <Card id="graduate" className="fused-docs-section">
          <p className="fused-kicker">Graduate</p>
          <h3>Locked liquidity on Uniswap</h3>
          <p>
            When enough quote has been bought on the curve, the token graduates. Remaining inventory and quote seed a
            Uniswap v4 pool at the last curve price. The LP position is locked. Nobody can pull the liquidity.
          </p>
          <p>After graduation, buys and sells route through that pool. The old curve cannot be drained.</p>
        </Card>

        <Card id="rewards" className="fused-docs-section">
          <p className="fused-kicker">Rewards</p>
          <h3>Creator curve rewards</h3>
          <p>
            Connect the wallet that launched a token to see claimable curve rewards for the network you are on. Rewards
            on other chains are not added together. Graduated Uniswap fees collected later are separate from the curve
            claim shown on Rewards.
          </p>
          <p>
            Paying the original post author through X Money is on the <a href="/roadmap">Roadmap</a>, not live yet.
          </p>
        </Card>

        <Card id="networks" className="fused-docs-section">
          <p className="fused-kicker">Networks</p>
          <h3>Robinhood and Arc</h3>
          <p>Switch networks from the header. Launches and trades use the chain your wallet is on.</p>
          <ul>
            <li>
              <strong>Robinhood Mainnet</strong> — quote is ETH.
            </li>
            <li>
              <strong>Arc Mainnet</strong> — quote is USDC.
            </li>
          </ul>
        </Card>

        <Card id="community" className="fused-docs-section">
          <p className="fused-kicker">Community</p>
          <h3>Find the conversation</h3>
          <p>
            The home page and <a href="/community">Community</a> show the FUSED feed. Connect a wallet to post. Use Fuse
            This on a post to send it into Launch with the text already filled in.
          </p>
        </Card>
      </div>
    </main>
  );
}
