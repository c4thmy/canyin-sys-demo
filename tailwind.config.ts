import type { Config } from "tailwindcss";

import { DATA_COLOR } from "./app/lib/theme";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** 上升绿 / 下降红 / 总计蓝：与 app/lib/theme.ts 的 DATA_COLOR 同源 */
        up: { DEFAULT: DATA_COLOR.up, soft: "#e8f6f1" },
        down: { DEFAULT: DATA_COLOR.down, soft: "#fdecec" },
        total: { DEFAULT: DATA_COLOR.total, soft: "#e8effd" },
      },
      fontSize: {
        /** 微型标签：表格注释、徽标 */
        nano: "10px",
        micro: "11px",
        /** 导航胶囊、表头小字 */
        meta: "13px",
        /** 正文与表格数字 */
        body: "15px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: ["SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
