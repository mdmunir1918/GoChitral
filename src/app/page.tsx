import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-svh place-content-center justify-items-center gap-5 px-6 text-center">
      <h1>
        <Link href="/" aria-label="GoChitral home" className="inline-block">
          <Image
            src="/brand/gochitral-logo.png"
            alt="GoChitral"
            width={1536}
            height={630}
            className="h-auto w-72 max-w-full"
            unoptimized
          />
        </Link>
      </h1>
      <p className="max-w-sm text-lg">A local guide and trip planner for Chitral.</p>
    </main>
  );
}
