# Maps and route estimates

## Providers and terms

- **Map tiles:** OpenStreetMap Foundation standard raster tiles at `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. The app asks only for tiles visible in an open map drawer, keeps the browser's normal cache behaviour, sends the normal site referrer and shows `© OpenStreetMap contributors` on the map. Do not add tile prefetching, an offline map download, a service-worker tile cache or a proxy. The OSMF tile service is best-effort; it has no service-level guarantee and can block harmful traffic. Its current policy asks clients to honour cache headers (or at least seven days if they cannot read them), forbids bulk/offline tile downloads and requires visible attribution: <https://operations.osmfoundation.org/policies/tiles/>.
- **Routes:** OSRM demo API at the fixed host `https://router.project-osrm.org`, driving profile only. Its demo service is for reasonable non-commercial use, asks clients not to exceed one request per second, and has no uptime, latency or data-freshness guarantee: <https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server>. The route adapter limits calls to one per 1.1 seconds per server process and applies a per-client window. It does not store route responses. Use an owned OSRM instance or a contracted routing provider before relying on it for a public production service.
- **No live road status:** Distance and time are estimates from the provider's current map graph. A route does not prove that a road is open or safe. Each place's visitor note remains separate and carries its review date.

## Coordinate sources for the mapped catalogue examples

- Bumburet Valley sample point: UNESCO's Kalasha Valley Cultural Landscape record lists the valley at 35°41′55.73″ N, 71°41′08.88″ E: <https://whc.unesco.org/en/tentativelists/6965>.
- Chitral town sample point: Getty's Thesaurus of Geographic Names cites the NGA gazetteer coordinates 35.8462, 71.7858: <https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=&nation=&place=&subjectid=1083406>.
- Kalasha Dur Museum sample point: OpenStreetMap-derived map record at 35.69746, 71.68216: <https://mapcarta.com/W1242417441>.

These are map points, not property entrances or route instructions. Listings without verified coordinates remain in the accessible text list and are not silently geocoded.

## Review

1. Open a listing with a map point or choose mapped stops for the same planner day.
2. Open the map drawer. Verify visible attribution, keyboard-accessible place names, notes and review dates.
3. Estimate a driving route between two or more mapped stops. If the provider is blocked, unreachable or out of quota, the names, notes and day order remain visible and the user can retry.
4. Try a listing without coordinates and verify that its text still works while route estimation is unavailable.
