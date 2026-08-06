import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lafl/core", "@lafl/marketpe"],
  // Monorepo: trace files from the repo root, not apps/web — and NEVER as an
  // absolute machine path, or Vercel's build machine can't resolve it and the
  // Next server runtime gets left out of the serverless bundle (500s).
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
