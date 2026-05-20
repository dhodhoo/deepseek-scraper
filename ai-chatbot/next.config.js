const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;
