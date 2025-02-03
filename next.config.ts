import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  },
};

export default nextConfig;
