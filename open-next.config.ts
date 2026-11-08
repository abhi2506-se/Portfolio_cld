import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// `npm run build` runs `opennextjs-cloudflare build`, which in turn runs the Next.js build below.
// (Without this override OpenNext would call `npm run build` again -> infinite recursion.)
// `build:next` = generate What's New data once, then `next build`.
//
// No ISR / `unstable_cache` / revalidateTag usage in this project, so the default
// (no incremental cache override) configuration is sufficient. If ISR is added later,
// configure an R2/KV incremental cache here: https://opennext.js.org/cloudflare/caching
export default {
  ...defineCloudflareConfig({}),
  buildCommand: 'npm run build:next',
}
