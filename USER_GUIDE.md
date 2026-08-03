# Lafl TMS — User Guide (Hinglish)

App chalao: `pnpm dev` → http://localhost:3000
Login: `ops@lauls.in` (supervisor — roz ka kaam) · `malyaj@lauls.in` (super admin — setup ka kaam)

---

## Ek trip ki poori zindagi — kya karna hai, kab karna hai

### 1️⃣ Trip banao (jab naya order/consignment aaye)
**Trips → + New Trip**

| Step | Kya karna | Matlab |
|---|---|---|
| **Vehicle** | Truck chuno (sirf khali trucks dikhte hain) | Yeh truck ab is trip ka hua |
| **E-Way Bill** | 12-digit EWB no. daal ke **Fetch** dabao | System sarkar ka bill khud padh lega — kiska maal, kitna, kahan, validity. Ek se zyada bill bhi laga sakte ho (ek truck, kai parties ka maal). Fetch fail ho toh **Manual entry** se haath se bharo. |
| **Route & Schedule** | Route chuno, start time + ETA dalo | ETA se hi "late chal raha hai" alert banta hai — imandari se dalo |
| **Crew** | Driver chuno (2nd driver optional) | Notes mein helper ka naam / instructions likh do |
| **Money** | **Load charges** dabao → amounts check/edit karo → advance dena ho toh **+ Advance** | Yeh COST side hai (diesel, bhatta, toll). Abhi dummy rates hain — real amounts khud daal do |
| **✓ Approve & Activate** | Sab check karke dabao | Trip **READY** — ab driver nikal sakta hai |

> System khud rokta hai agar: EWB expired ho / doosri trip pe laga ho / truck pehle se busy ho / driver assign na ho. Error message padh lo, wahi batayega kya missing hai.

### 2️⃣ Trip chalao (statuses ka matlab)
Trip page pe upar bade button se status badhao (GPS poller chal raha ho toh kuch khud bhi ho jayega):

| Status | Matlab | Kaise lagta hai |
|---|---|---|
| `ready` | Maal load, driver set, nikalne wala hai | Activate ke baad |
| `in_transit` | Rasta pakad liya | **Start Trip** button — ya truck yard se nikla toh AUTO |
| `at_destination` | Customer ke gate pe pahunch gaya | **Mark Arrived** — ya geofence se AUTO |
| `unloaded` | Maal utar gaya | **Unload Completed** |
| `ops_closed` | Truck wahan se nikal gaya, **truck FREE** agli trip ke liye | **Vehicle Left — Close Ops** — ya geofence exit se AUTO |
| `completed` | POD verified + driver ka paisa done — file band | **KHUD hota hai**, koi button nahi |

Galti/cancel: `Cancel Trip` (start se pehle) ya `Abort` (raste mein) — reason likhna zaroori hai.

### 3️⃣ POD (maal pahunchne ka saboot)
POD aane ke **do raaste** hain — dono ka data ek hi verify queue mein girta hai:

**Raasta A — WhatsApp (permanent, jaise aaj hota hai):**
- Driver se stamped POD ki photo WhatsApp pe lo
- Trip page → **Proof of Delivery** section → photo **Upload POD** (kaunse EWB ka hai chun lo)

**Raasta B — QR / link (optional, supervisor ka kaam bachata hai):**
- Trip Sheet print pe ab **QR code** chhapta hai — driver maal utaar ke scan kare → camera khule → photo kheenche → POD seedha SAHI trip pe pahunch jata hai. No app, no login.
- Ya trip page pe **"Share POD link ↗"** dabao → link driver ko normal WhatsApp pe bhej do (sheet kho gayi / market vehicle ho tab kaam aata hai)
- QR se aayi photo pe **"via QR"** ka tag + capture location dikhti hai (photo delivery point pe li gayi ya nahi — proof)
- Dhundhli/andheri photo driver ke phone pe hi warning deti hai — supervisor tak kachra kam pahunchega

**Verify (dono raaston ke baad, hamesha insaan):**
- **PODs** page pe queue: photo kholo → sahi hai **Verify** / dhundhli-galat hai **Reject** (reason likho, driver dobara bhejega)
- Rule: **har EWB ka POD chahiye** tabhi trip ka POD "verified" hota hai

### 4️⃣ Driver ka hisaab (Settlement)
Trip `ops_closed` hone ke baad → trip page → **Driver Settlement** → **Generate**
- System khud jodta hai: bhatta + approved kharche − diye hue advances
- Bonus/penalty edit karo (penalty pe reason zaroori)
- **LAAL "RECOVERY DUE"** dikhe = advance zyada de diya tha, driver se paisa LENA hai
- Paisa **MarketPe se hi do** (jaise aaj dete ho) — phir yahan **Mark Paid** + UTR
  - Ya kuch mat karo: **chowkidaar script** raat ko MarketPe se khud match karke PAID kar dega
- Advance baad mein add kiya? System purane hisaab pe pay nahi karne dega — pehle Save, phir Pay

### 5️⃣ Customer ka bill (Invoice)
Trip page → **Customer Billing** → customer chuno (GSTIN wala) → contract line chuno (Tata rates aa jayenge) → weight EWB se khud bhara hai → **Generate invoice**
- Rate × MT = freight, khud calculate
- Paisa aaye toh **Record receipt** (adhura bhi chalega — partial supported)
- **Invoices** page pe sab pending + OVERDUE laal mein

### 6️⃣ Dashboard roz subah dekho
- **Tiles**: kitne truck free, kitni trips chal rahi, POD/payment kitne atke
- **Live Map**: har truck kahan hai (green = free, amber = trip pe)
- **Alerts**: 🚨 laal pehle dekho — EWB expire hone wala (LEGAL, turant extend karao), GPS chup, ⚠️ late trips, overdue bills

---

## Scripts (terminal se, jab chahiye)

```bash
cd apps/web
# GPS fresh karo (map ke liye) — jitni baar chaaho
pnpm dlx tsx scripts/poll-intangles.ts <ORG_ID>
# Chowkidaar — MarketPe payments se settlements auto-match
pnpm dlx tsx scripts/sync-payments.ts <ORG_ID> 30
# MarketPe masters refresh (naye driver/truck aaye ho)
pnpm dlx tsx scripts/sync-masters.ts <ORG_ID>
# Naye yards dhundo (parked truck clusters se)
pnpm dlx tsx scripts/discover-sites.ts <ORG_ID>
```
Lauls ORG_ID: `6542d31e-33d5-450b-9ef4-a0855f80113f`

## Kya AUTO hai vs kya HAATH se (abhi ke stage pe)

| Auto ✅ | Haath se (abhi) ✋ |
|---|---|
| EWB fetch + validity check | Trip banana |
| Weight/total MT | POD upload agar WhatsApp se aaye (QR se aaye toh AUTO ✅) |
| Yard-exit → trip start (poller on ho) | Status buttons (poller off ho toh) |
| Geofence → reached/closed (poller on) | Payment dena (MarketPe mein, hamesha) |
| Settlement math + recovery flag | Receipt entry |
| Invoice math (rate × MT) | Driver ko khabar karna (WhatsApp worker aana baaki) |
| Trip completion + alerts | |

## Safety notes
- Lafl **MarketPe/sarkar/Intangles mein kuch NahI likhta** — sirf padhta hai. Unke systems bilkul safe.
- Har action ka audit log hai (trip page → Timeline) — kaun, kab, kya.
- Password chat mein aa chuke hain — team ko dene se pehle badal lena.
