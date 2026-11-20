#!/usr/bin/env node
/**
 * Live preview on a real phone (same Wi-Fi as this Mac).
 *   npm run dev:phone
 * Prints the LAN URL and a QR code; Vite hot-reloads as files change.
 */
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import qrcode from "qrcode-terminal";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

function lanAddress(){
  for(const list of Object.values(os.networkInterfaces())){
    for(const n of list??[]){
      if(n.family==="IPv4"&&!n.internal)return n.address;
    }
  }
  return null;
}

const server=await createServer({root,server:{host:true,port:5173,strictPort:false}});
await server.listen();
const port=server.config.server.port;
const ip=lanAddress();

console.log("\nMobile live preview\n");
if(!ip){
  console.log("No LAN address found. Connect this Mac to Wi-Fi and run again.");
}else{
  const url=`http://${ip}:${port}/`;
  console.log(`  Open on your phone: ${url}\n`);
  qrcode.generate(url,{small:true});
  console.log("\n  Phone must be on the same Wi-Fi. Ctrl+C to stop.");
  console.log("  No phone handy (e.g. downtime)? Run: npm run shots\n");
}
