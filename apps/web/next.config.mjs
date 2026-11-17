/** @type {import('next').NextConfig} */
export default {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@open-campus/ui', '@open-campus/core', '@open-campus/schema', '@open-campus/tools'],
  webpack(config) {
    // Workspace packages use NodeNext-style `./x.js` imports that point at `.ts` sources.
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};
