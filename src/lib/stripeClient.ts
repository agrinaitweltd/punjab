import { loadStripe, type Stripe } from "@stripe/stripe-js"

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

let stripePromise: Promise<Stripe | null> | null = null

/** Publishable keys are meant to be public/client-side — this is safe to ship in the bundle. */
export function getStripe(): Promise<Stripe | null> {
  if (!key) return Promise.resolve(null)
  if (!stripePromise) stripePromise = loadStripe(key)
  return stripePromise
}

export const stripeConfigured = Boolean(key)
