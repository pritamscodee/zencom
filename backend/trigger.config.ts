import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_tzvztbqfbskcqpbfihda",
  dirs: ["./src/trigger"],
  runtime: "node",
  maxDuration: 600,
  retries: {
    enabledInDev: true,
    default: { maxAttempts: 3, minTimeoutInMs: 1000, maxTimeoutInMs: 10000, factor: 2 },
  },
  build: {
    extensions: [prismaExtension({ mode: "modern" })],
    // pdf-parse -> pdfjs-dist needs the native @napi-rs/canvas binary (DOMMatrix polyfill)
    // and its pdf.worker file at runtime; bundling breaks both, so install them in the image.
    external: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  },
});
