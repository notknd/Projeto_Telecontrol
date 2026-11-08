import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL("../..", import.meta.url)), [
    "API_PROXY_TARGET",
    "WEB_PORT",
  ]);
  return {
    plugins: [vue()],
    server: {
      host: "127.0.0.1",
      port: Number(process.env.WEB_PORT ?? env.WEB_PORT ?? 5173),
      proxy: {
        "/api": {
          target:
            process.env.API_PROXY_TARGET ??
            env.API_PROXY_TARGET ??
            "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
