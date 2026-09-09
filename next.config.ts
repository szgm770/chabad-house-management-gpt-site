import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/setup": ["./drizzle/*.sql"],
  },
};

export default nextConfig;
