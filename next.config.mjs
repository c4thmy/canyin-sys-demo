/** @type {import("next").NextConfig} */
const nextConfig = {
  // Dockerfile 用 standalone 产物运行：.next/standalone/server.js
  output: "standalone",
  webpack(config) {
    // 指标引擎沿用 `.js` 说明符（如 "./period.js"），
    // 让 webpack 也能把它解析到同名 `.ts` 源文件。
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
