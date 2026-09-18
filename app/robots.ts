import type { MetadataRoute } from "next";

/** The app is a signed-in product; nothing on this host is for search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
