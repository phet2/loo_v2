# Deploy บน Cloudflare Pages — คู่มือ

โฟลเดอร์นี้พร้อม deploy แล้ว (static ล้วน ไม่ต้อง build)

## ไฟล์ในโปรเจกต์
| ไฟล์ | หน้าที่ |
|------|--------|
| `index.html` | หน้า hub (ปุ่มเข้า 2 เอกสาร + progress รวม) |
| `LOO-Customer-Brain-Overview.html` | สะบับเข้าใจง่าย (สำหรับทุกคน) |
| `LOO-Customer-Brain-Plan.html` | Dev Technical Reference ⚠️ **ภายใน/NDA** |
| `loo-checklist.js` | engine ติ๊ก + sync realtime (Firebase ตั้งค่าแล้ว) |
| `_headers` | HTTP headers (security + cache) ของ Cloudflare Pages |
| `404.html` | หน้า not-found |

---

## วิธี deploy

### วิธี A — ผ่าน Git (auto-deploy ทุกครั้งที่ push) — แนะนำ
1. push โฟลเดอร์นี้ขึ้น GitHub/GitLab (เป็น repo อยู่แล้ว)
2. **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**
3. เลือก repo → ตั้งค่า build:
   - **Framework preset:** `None`
   - **Build command:** (เว้นว่าง)
   - **Build output directory:** `/`  (ไฟล์อยู่ที่ราก repo)
4. **Save and Deploy** → ได้ URL `ชื่อ.pages.dev` · push ครั้งต่อไป deploy เองอัตโนมัติ

### วิธี B — Direct Upload (ลากไฟล์ ไม่ต้องใช้ Git)
1. **Workers & Pages → Create → Pages → Upload assets**
2. ตั้งชื่อ project (เช่น `loo-plan`)
3. ลาก **ไฟล์ทั้งหมดในโฟลเดอร์นี้** (index.html, 2 เอกสาร, loo-checklist.js, _headers, 404.html) เข้าไป
4. **Deploy** → ได้ URL `ชื่อ.pages.dev`

> ⚠️ อย่าลาก `.git/` ขึ้นไป (ไม่จำเป็น) · วิธี B ลากเฉพาะ 6 ไฟล์ก็พอ

---

## 🔒 ป้องกัน NDA + ให้ "ทุกคนในบริษัท" ดูได้ (Cloudflare Access) — แนะนำ
วิธีนี้ตอบโจทย์ "ดูได้ทุกคนผ่านเว็บ" แบบปลอดภัย: **คนในบริษัทล็อกอินอีเมลแล้วดูได้ทุกคน · คนนอกเปิดไม่ได้**

1. **Cloudflare dashboard → Zero Trust** (ครั้งแรกตั้งชื่อ team สั้นๆ · แผนฟรีรองรับ 50 คน)
2. **Access → Applications → Add an application → Self-hosted**
3. ตั้งค่า:
   - **Application name:** `LOO แผนงาน`
   - **Domain:** ใส่ `ชื่อ.pages.dev`
     - ป้องกัน **ทั้งเว็บ** → ใส่แค่ domain
     - ป้องกัน **เฉพาะ Plan (NDA)** → ใส่ domain + path `/LOO-Customer-Brain-Plan.html` (Overview กับ hub ยังเปิดสาธารณะ)
4. **Add policy:** Action = `Allow` → Include = `Emails ending in` → `@varilao.com` (โดเมนบริษัท)
5. Save → จากนี้เปิดหน้าต้องล็อกอินอีเมลบริษัทก่อน

---

## หลัง deploy: ทดสอบ
1. เปิด `ชื่อ.pages.dev` บน **คอม** และ **มือถือ** พร้อมกัน
2. ติ๊กช่องนึงบนคอม → มือถือต้องเห็นเปลี่ยนภายใน ~1 วิ (chip ขึ้น "live sync")
3. เสร็จ — ส่งลิงก์ให้หัวหน้าได้เลย

## หมายเหตุ
- **Firebase config ในโค้ดเปิดเผยได้** (ออกแบบมาแบบนั้น · ความปลอดภัยอยู่ที่ Rules) commit/ขึ้น public repo ได้
- **ข้อมูลติ๊ก** เปิดให้ใครก็ตามที่มี URL อ่าน/เขียนได้ (Rules เปิด path `space/loo-customer-brain`) — ภายในทีมถือว่าโอเค · ถ้าจะล็อกให้ใส่ **Cloudflare Access** (ข้างบน) หรือเพิ่ม Firebase Auth ภายหลัง
- เปลี่ยน plan ในอนาคต: แก้ HTML แล้ว push (วิธี A) หรือ re-upload (วิธี B) · `_headers` ตั้งให้ HTML revalidate เสมอ จะเห็นของใหม่ทันที ไม่ค้าง cache
