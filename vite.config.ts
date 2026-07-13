import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs so the build works at github.io/speech.website/ and at the apex.
  base: "./",
  plugins: [react()],
});
