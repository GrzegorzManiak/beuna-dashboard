import path from "path"
import net from "node:net"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const API_TARGET = process.env.VITE_API_TARGET ?? "http://localhost:5713"
const socketProto = net.Socket.prototype as net.Socket & { destroySoon?: () => void }
if (typeof socketProto.destroySoon !== "function") {
  socketProto.destroySoon = function(this: net.Socket){
    this.destroy()
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: true,
    cors: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    host: true,
    cors: true,
    allowedHosts: true,
  },
})
