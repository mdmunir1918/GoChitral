import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogue } from "@/features/catalogue/catalogue";
import { categoryLabels, listingUrl } from "@/features/catalogue/types";
import "./detail.css";

type Props = PageProps<"/[category]/[slug]">;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const detail = await catalogue.detail(category, slug);
  if (!detail) notFound();
  return { title: detail.item.title, description: detail.item.summary };
}

export default async function ListingPage({ params }: Props) {
  const { category, slug } = await params;
  const detail = await catalogue.detail(category, slug);
  if (!detail) notFound();
  const { item, related } = detail;
  const photo = item.photo;
  const reviewed = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(item.reviewed));
  return (
    <article className="frame listing-page">
      <Link className="text-link" href="/explore">← Back to Explore</Link>
      <div className="detail-layout">
        <header>
          <p className="listing-location">{categoryLabels[item.category]} · {item.location}</p>
          <h1>{item.title}</h1>
          <p className="detail-intro">{item.summary}</p>
        </header>
        <figure>
          <Image src={photo.src} width={photo.width} height={photo.height} alt={photo.alt}
            sizes="(max-width: 768px) 90vw, 47vw" preload />
          <figcaption>
            <span>{photo.caption}</span>
            <span className="credit"><a href={photo.original}>{photo.author}</a> · <a href={`https://creativecommons.org/licenses/by-sa/${photo.license}/`}>CC BY-SA {photo.license}</a></span>
          </figcaption>
        </figure>
        <div className="visitor-details">
          <h2>About {item.title}</h2>
          <p>{item.description}</p>
          <h2>Visitor notes</h2>
          <p>{item.visitorNote}</p>
          {item.contactUrl && <p><a className="text-link" href={item.contactUrl}>Public contact website</a></p>}
          {item.latitude !== undefined && item.longitude !== undefined && <p>Coordinates · {item.latitude}, {item.longitude}</p>}
          <p className="source-note">Development listing · Reviewed <time dateTime={item.reviewed}>{reviewed}</time>
            {item.source && <><br /><a className="text-link" href={item.source.url}>{item.source.title}</a></>}
          </p>
        </div>
      </div>
      {related.length > 0 && <section className="related-listings">
        <h2>More in {item.location}</h2>
        <ul>{related.map((record) => <li key={record.id}>
          <Link href={listingUrl(record)}>{record.title} <span aria-hidden="true">→</span></Link>
          <span className="listing-location">{categoryLabels[record.category]}</span>
        </li>)}</ul>
      </section>}
    </article>
  );
}
