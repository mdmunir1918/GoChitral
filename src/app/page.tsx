import Image from "next/image";
import Link from "next/link";
import { PlaceSearch } from "@/components/place-search";

export default function Home() {
  return (
    <div className="frame home">
      <section className="hero-copy" aria-labelledby="home-title">
        <p className="location">Hindu Kush <span aria-hidden="true">/</span> Pakistan</p>
        <h1 id="home-title">Discover <em>Chitral.</em></h1>
        <p className="intro">A local travel guide to the valleys and mountain landscapes of Chitral.</p>
        <PlaceSearch />
        <Link className="browse-link" href="/assistant">Ask the GoChitral assistant <span aria-hidden="true">→</span></Link>
        <Link className="text-link" href="/plan">Or plan the trip yourself</Link>
        <Link className="browse-link" href="/explore">Explore the guide <span aria-hidden="true">→</span></Link>
      </section>
      <figure className="landscape">
        <Image src="/images/chitral-and-tirich-mir.webp" width={1400} height={927}
          alt="Snow-covered Tirich Mir rises above Chitral town and the river."
          className="landscape-photo" preload unoptimized />
        <figcaption>
          <span className="photo-title">Chitral &amp; Tirich Mir</span>
          <span className="credit">
            <a href="https://commons.wikimedia.org/wiki/File:The_City_of_Chitral_and_Tirich_Mir.jpg">Emaad Paracha</a>
            {" · "}<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
