import { readFileSync } from "node:fs";
import { parseEwayResponse } from "@lafl/marketpe";
for (const n of ["342303510508", "332303766559", "302302691758"]) {
  const raw = JSON.parse(readFileSync(`/tmp/ewb_${n}.json`, "utf8"));
  const s = parseEwayResponse(raw);
  console.log(`${n}: ${s?.consignorName} -> ${s?.consigneeName} | ${s?.material?.slice(0,30)} | ${s?.weightKg}kg | inv ${s?.invoiceNo} rs.${s?.invoiceValue} | valid ${s?.validUntil} | ${s?.distanceKm}km | ${s?.status}`);
}
