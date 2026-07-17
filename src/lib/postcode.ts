/* UK postcode lookup via Postcodes.io — a free, public API that requires
   no API key (any key supplied to it is simply ignored by the real service). */

export type PostcodeResult = {
  postcode: string
  region: string | null
  adminDistrict: string | null
  adminWard: string | null
  parish: string | null
  parliamentaryConstituency: string | null
  latitude: number
  longitude: number
}

const AREA_ALIASES: Record<string, string[]> = {
  "Greater London": ["London", "Camden", "Westminster", "Hackney", "Islington", "Southwark", "Lambeth", "Greenwich"],
  Essex: ["Essex"],
  Kent: ["Kent"],
  Surrey: ["Surrey"],
  Hertfordshire: ["Hertfordshire"],
  Buckinghamshire: ["Buckinghamshire"],
  Berkshire: ["Berkshire", "Reading", "Slough"],
  Oxfordshire: ["Oxfordshire", "Oxford"],
  Cambridgeshire: ["Cambridgeshire", "Cambridge"],
  Bedfordshire: ["Bedfordshire", "Luton"],
  Northamptonshire: ["Northamptonshire"],
  Birmingham: ["Birmingham"],
  Manchester: ["Manchester"],
  Liverpool: ["Liverpool"],
  Leeds: ["Leeds"],
  Sheffield: ["Sheffield"],
  Nottingham: ["Nottingham"],
  Leicester: ["Leicester"],
  Bristol: ["Bristol"],
  Cardiff: ["Cardiff"],
  Edinburgh: ["Edinburgh"],
  Glasgow: ["Glasgow"],
  Newcastle: ["Newcastle"],
  Southampton: ["Southampton"],
  Portsmouth: ["Portsmouth"],
  Brighton: ["Brighton"],
  "Milton Keynes": ["Milton Keynes"],
  Coventry: ["Coventry"],
  Wolverhampton: ["Wolverhampton"],
  Reading: ["Reading"],
  Slough: ["Slough"],
  Luton: ["Luton"],
}

export async function lookupPostcode(rawPostcode: string): Promise<{ ok: true; result: PostcodeResult } | { ok: false; error: string }> {
  const postcode = rawPostcode.trim()
  if (!postcode) return { ok: false, error: "Enter a postcode." }
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
    const body = await res.json()
    if (!res.ok || body.status !== 200) {
      return { ok: false, error: "That postcode couldn't be found — please double-check it." }
    }
    const r = body.result
    return {
      ok: true,
      result: {
        postcode: r.postcode,
        region: r.region ?? null,
        adminDistrict: r.admin_district ?? null,
        adminWard: r.admin_ward ?? null,
        parish: r.parish ?? null,
        parliamentaryConstituency: r.parliamentary_constituency ?? null,
        latitude: r.latitude,
        longitude: r.longitude,
      },
    }
  } catch {
    return { ok: false, error: "Couldn't reach the postcode lookup service — check your connection." }
  }
}

/** Postcodes.io only resolves a postcode to its area (district/ward/region) —
    it has no premises-level address database, so we can't return real building
    addresses to pick from. We build sensible candidate locality lines from the
    real area data instead, and the customer still picks the one that matches
    plus types their house name/number. */
export function buildAddressCandidates(result: PostcodeResult): string[] {
  const town = result.adminDistrict ?? result.region ?? ""
  const lines = new Set<string>()
  if (result.adminWard && result.adminWard !== town) lines.add(`${result.adminWard}, ${town}`)
  if (result.parish && result.parish !== town && result.parish !== result.adminWard) lines.add(`${result.parish}, ${town}`)
  if (town) lines.add(town)
  return [...lines]
}

export type FullAddress = { full: string }

/** Full premises-level address lookup via Ideal Postcodes (paid, key held
    server-side in the /api/lookup-address proxy — never exposed to the client).
    Falls back gracefully (ok:false) if the key isn't configured, the postcode
    has no listed addresses, or the request fails for any reason, so the UI
    can drop back to manual address entry. */
export async function lookupFullAddresses(rawPostcode: string): Promise<{ ok: true; addresses: FullAddress[] } | { ok: false; error: string }> {
  const postcode = rawPostcode.trim()
  if (!postcode) return { ok: false, error: "Enter a postcode." }
  try {
    const res = await fetch(`/api/lookup-address?postcode=${encodeURIComponent(postcode)}`)
    const body = await res.json()
    if (!res.ok || !Array.isArray(body.addresses) || body.addresses.length === 0) {
      return { ok: false, error: "We couldn't find any addresses for that postcode." }
    }
    return { ok: true, addresses: body.addresses.map((a: { full: string }) => ({ full: a.full })) }
  } catch {
    return { ok: false, error: "Couldn't reach the address lookup service." }
  }
}

/** Matches a postcode-lookup result against our known UK delivery areas. */
export function matchDeliveryArea(result: PostcodeResult, areaNames: string[]): string | null {
  const haystack = `${result.adminDistrict ?? ""} ${result.region ?? ""}`.toLowerCase()
  for (const area of areaNames) {
    const aliases = AREA_ALIASES[area] ?? [area]
    if (aliases.some(a => haystack.includes(a.toLowerCase()))) return area
  }
  return null
}
