import type { Listing, Photo } from "@/features/catalogue/types";

const valleyPhoto: Photo = {
  src: "/images/bumburet-valley.webp", width: 1280, height: 960,
  alt: "A rainbow crosses the mountainside above a stone and timber building in Bumburet Valley.",
  caption: "Bumburet Valley", author: "Numan Ali", license: "4.0",
  original: "https://commons.wikimedia.org/wiki/File:Bumburet_Valley_XWJJ9009.jpg",
};
const townPhoto: Photo = {
  src: "/images/chitral-and-tirich-mir.webp", width: 1400, height: 927,
  alt: "The river winds past Chitral town beneath the snow-covered peak of Tirich Mir.",
  caption: "Chitral town and Tirich Mir", author: "Emaad Paracha", license: "4.0",
  original: "https://commons.wikimedia.org/wiki/File:The_City_of_Chitral_and_Tirich_Mir.jpg",
};
const museumPhoto: Photo = {
  src: "/images/kalasha-dur.webp", width: 800, height: 536,
  alt: "Visitors stand beside a suspended wooden vessel at Kalasha Dur Museum.",
  caption: "Kalasha Dur Museum", author: "G.H. Farooqui", license: "3.0",
  original: "https://commons.wikimedia.org/wiki/File:Chitral_Kalash_Museum.jpg",
};

const reviewed = "2026-11-09";
const valley: Listing = {
  id: "dest-001", category: "destinations", slug: "bumburet-valley", title: "Bumburet Valley",
  location: "Bumburet", status: "published", reviewed, photo: valleyPhoto,
  latitude: 35.698814, longitude: 71.685800,
  summary: "Explore a Kalasha valley of villages, carved timber buildings and mountain pastures.",
  description: "Bumburet is one of Chitral’s three Kalasha valleys, alongside Rumbur and Birir. In the village of Brun, the Kalasha culture centre brings local history and objects from everyday life together under one roof.",
  visitorNote: "Start in Brun if the museum is part of your visit. Ask residents before photographing people, entering homes or approaching ceremonial spaces.",
  source: { title: "Tourism Corporation Khyber Pakhtunkhwa · Kalash guide", url: "https://tourism.gov.pk/publications/Kalash%20Broucher%2023x18.pdf" },
};
const town: Listing = {
  id: "dest-002", category: "destinations", slug: "chitral-town", title: "Chitral Town",
  location: "Chitral town", status: "published", reviewed, photo: townPhoto,
  latitude: 35.8462, longitude: 71.7858,
  summary: "Discover the riverside town below Tirich Mir and its collection of regional heritage.",
  description: "Chitral town sits along the river, with Tirich Mir rising beyond the rooftops. Pair a view across the valley with time at Chitral Museum, where the galleries introduce the region’s material culture.",
  visitorNote: "Ask at the museum about opening hours before planning the rest of your day around a visit.",
  source: { title: "Department of Archaeology and Museums · Chitral Museum", url: "https://doam.gov.pk/public/heritage-sites/785" },
};
const sampleHotel: Listing = {
  id: "hotel-001", category: "hotels", slug: "sample-town-guesthouse", title: "Sample town guesthouse",
  destinationId: town.id, location: town.location, status: "published", reviewed, photo: townPhoto,
  summary: "A fictional guesthouse listing for exploring stays around Chitral town.",
  description: "This development example shows where a town guesthouse appears alongside its destination and nearby activities. The photograph shows the surrounding town.",
  visitorNote: "This is a sample property. It has no rooms, rates or contact details available for booking.",
};
const sampleGuide: Listing = {
  id: "guide-001", category: "guides", slug: "sample-bumburet-guide", title: "Sample Bumburet guide",
  destinationId: valley.id, location: valley.location, status: "published", reviewed, photo: valleyPhoto,
  summary: "A fictional guide profile linked to Bumburet and its cultural sites.",
  description: "This example represents a local guiding profile for visitors interested in the valley and Kalasha Dur Museum. The photograph shows the area covered by the profile.",
  visitorNote: "This sample profile has no named operator, verified credentials or booking availability.",
};

// Private development fixtures. Hidden records exercise the same publication checks as public examples.
export const fixtures: Listing[] = [
  valley, town,
  {
    id: "act-001", category: "activities", slug: "kalasha-dur-museum", title: "Kalasha Dur Museum",
    destinationId: valley.id, location: valley.location, status: "published", reviewed, photo: museumPhoto,
    latitude: 35.69746, longitude: 71.68216,
    summary: "Look into Kalasha material culture through the museum’s collection in Bumburet.",
    description: "The museum’s ground floor holds objects from Kalasha communities and the wider Hindu Kush. The building also houses a school and a library dedicated to Kalasha culture.",
    visitorNote: "Confirm visiting hours and photography permissions with museum staff. Allow time to look closely at how household objects were made and used.",
    source: { title: "Department of Archaeology and Museums · Kalasha Dur Museum", url: "https://doam.gov.pk/public/heritage-sites/799" },
  },
  {
    id: "act-002", category: "activities", slug: "chitral-museum", title: "Chitral Museum",
    destinationId: town.id, location: town.location, status: "published", reviewed, photo: townPhoto,
    summary: "Visit two galleries devoted to Chitral’s everyday life and archaeological heritage.",
    description: "The ethnological gallery introduces life in Chitral, while the archaeological and Kalash gallery brings together objects from the valleys. Each offers a different starting point for exploring the region.",
    visitorNote: "Check current opening hours and admission with the museum before setting out.",
    source: town.source,
  },
  sampleHotel, sampleGuide,
  { ...sampleHotel, id: "hotel-002", slug: "draft-town-stay", title: "Draft town stay", status: "draft" },
  { ...sampleGuide, id: "guide-002", slug: "suspended-valley-guide", title: "Suspended valley guide", status: "suspended" },
];
