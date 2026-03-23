import { defineConfig, build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import sharp from "sharp";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "build-background",
      async closeBundle() {
        // Build background service worker as a self-contained IIFE
        // (MV3 service workers cannot use ES module chunk imports)
        await viteBuild({
          configFile: false,
          build: {
            outDir: resolve(__dirname, "dist"),
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, "src/background/index.ts"),
              formats: ["iife"],
              name: "background",
              fileName: () => "background.js",
            },
            rollupOptions: {
              output: { extend: true },
            },
          },
        });

        copyFileSync(
          resolve(__dirname, "manifest.json"),
          resolve(__dirname, "dist", "manifest.json")
        );

        // Resize icon.png to required sizes for the extension
        const pngBuffer = readFileSync(
          resolve(__dirname, "public/icons/icon.png")
        );
        const iconsDir = resolve(__dirname, "dist/icons");
        if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
        for (const size of [16, 48, 128]) {
          await sharp(pngBuffer)
            .resize(size, size, { kernel: sharp.kernel.lanczos3 })
            .png({ quality: 100, compressionLevel: 0 })
            .toFile(resolve(iconsDir, `icon${size}.png`));
        }
      },
    },
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
