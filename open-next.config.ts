import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// No ISR / `unstable_cache` / revalidateTag usage in this project, so the default
// (no incremental cache override) configuration is sufficient. If ISR is added later,
// configure an R2/KV incremental cache here: https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({})
