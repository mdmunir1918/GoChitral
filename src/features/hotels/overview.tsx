export type RoomOverview = { id: string; title: string; capacity: number; nightlyMinor: number | null; availabilityNote: string };
export function HotelOverview({ amenities, rooms }: { amenities: string[]; rooms: RoomOverview[] }) {
  return <section className="hotel-overview"><h2>Amenities</h2>
    {amenities.length ? <ul className="hotel-amenities">{amenities.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Contact the hotel for its amenities.</p>}
    <h2>Room types and current rates</h2><p>Rates are estimates in PKR per night. Confirm the price and availability with the hotel.</p>
    {!rooms.length && <p>No published room types yet. Contact the hotel for details.</p>}
    <div className="hotel-room-list">{rooms.map((room) => <article key={room.id}><h3>{room.title}</h3><p>Up to {room.capacity} guests</p><p>{room.nightlyMinor === null ? "Ask the hotel for its rate" : `${new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(room.nightlyMinor / 100)} per night`}</p>{room.availabilityNote && <p>{room.availabilityNote}</p>}</article>)}</div>
  </section>;
}
