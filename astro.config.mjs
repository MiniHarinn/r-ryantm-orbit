// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import react from "@astrojs/react"

// https://astro.build/config
export default defineConfig({
  site: "https://miniharinn.github.io",
  base: "/r-ryantm-orbit/",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
})
