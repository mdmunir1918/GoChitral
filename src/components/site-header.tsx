import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { SiteNavigation } from "./site-navigation";

export function SiteHeader() {
  const logoPath = "/brand/gochitral-logo.png";
  const hasLogo = existsSync(path.join(process.cwd(), "public", logoPath));
  if (!hasLogo) {
    console.warn(`GoChitral artwork missing at public${logoPath}. Using the text wordmark.`);
  }

  return (
    <header className="site-header">
      <div className="frame header-row">
        <Link href="/" aria-label="GoChitral home" className="brand">
          {hasLogo ? (
            <Image src={logoPath} width={1536} height={630} alt="GoChitral" unoptimized />
          ) : "GoChitral"}
        </Link>
        <SiteNavigation />
      </div>
    </header>
  );
}
