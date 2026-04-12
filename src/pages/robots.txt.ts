export function GET({ site }: { site?: URL }) {
  const lines = ["User-agent: *", "Allow: /"]

  if (site) {
    const origin = site.toString().replace(/\/$/, "")
    lines.push("", `Sitemap: ${origin}/sitemap-index.xml`)
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
