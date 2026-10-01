// Mock-only preview of the control in a plain browser page: `npm run preview`.
// It renders the same <ChatApp> the PCF control renders, with the sample-data API.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 5173, strictPort: true },
  build: { outDir: "../dist/preview", emptyOutDir: true },
});
