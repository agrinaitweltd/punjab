/* UK postcode lookup via Postcodes.io — a free, public API that requires
   no API key (any key supplied to it is simply ignored by the real service). */

export type PostcodeResult = {
  postcode: string
  region: string | null
  adminDistrict: string | null
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
        parliamentaryConstituency: r.parliamentary_constituency ?? null,
        latitude: r.latitude,
        longitude: r.longitude,
      },
    }
  } catch {
    return { ok: false, error: "Couldn't reach the postcode lookup service — check your connection." }
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
