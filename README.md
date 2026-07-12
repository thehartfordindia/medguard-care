# 🩺 MedGuard Care — Web App

A responsive patient-care web app: **door-to-door medicine delivery** and **at-home
doctor / nurse / caretaker booking** with **live geolocation** and **online consultations**.

> This is the customer-facing web app. It lives alongside (and does not touch) the
> existing MedGuard_AI Python analytics modules in the parent folder.

## ✨ Features

- **💊 Medicine catalog** — search by name, symptom or category; add to cart; Rx flagging; free delivery over ₹500.
- **🩺 Medical devices & equipment** — BP monitors, glucometers, nebulizers, mobility aids, first-aid kits and more.
- **🧪 Lab tests at home** — book diagnostic tests and health packages with free home sample collection (over ₹500).
- **🎟️ Promo codes** — apply coupons (e.g. `MED10`, `FIRST50`, `CARE20`, `LAB25`) at checkout for instant discounts.
- **📍 Geolocation** — finds your nearest MedGuard hub and shows a live delivery ETA on a map.
- **⚕️ Care providers** — book doctors, nurses and caretakers for **home visits** or **online consults**, sorted by distance.
- **📦 Order tracking** — track medicine orders, lab bookings and care bookings by reference.
- **🎧 Customer support** — raise a support ticket, request a callback, and look up ticket status.
- **🤖 Care Assistant** — a built-in chatbot for help with orders, bookings and consults.
- **🖥️ Ops console** — `/admin` lets staff view orders/tickets and update statuses (secured by `ADMIN_SECRET`).
- **🌙 Dark mode**, fully responsive for mobile, tablet and desktop.

## 🏗️ Tech

- **Backend:** Node.js native `http` (no framework). File-based JSON storage by default, or
  PostgreSQL when `DATABASE_URL` is set.
- **Frontend:** vanilla HTML/CSS/JS + Leaflet (OpenStreetMap) for maps. No build step.
- **Maps & geo:** browser Geolocation API + Leaflet/OSM (no API keys).

## 🚀 Run locally

```powershell
cd webapp
node backend/server.js
# open http://localhost:8790
```

Optional: copy `.env.example` to `.env` to set `PORT`, `ADMIN_SECRET`, or `DATABASE_URL`.

## 🔌 API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health + storage mode |
| GET | `/api/catalog` | Medicines + devices + categories |
| GET | `/api/lab-tests` | Lab tests + categories |
| POST | `/api/coupon` | Validate a promo code `{code, amount}` |
| GET | `/api/providers?role=&lat=&lon=` | Care providers (sorted by distance) |
| GET | `/api/pharmacy/nearest?lat=&lon=` | Nearest hub + delivery ETA |
| POST | `/api/quote` | Price a cart |
| POST | `/api/orders` | Create medicine order, lab booking or care booking |
| GET | `/api/orders/:id` | Track an order |
| POST | `/api/support` | Raise a support ticket / callback |
| GET | `/api/support/:id` | Look up a ticket |
| GET | `/api/admin/orders` | (secured) list orders |
| GET | `/api/admin/tickets` | (secured) list support tickets |
| POST | `/api/admin/status` | (secured) update order status |

## ☁️ Deploy

`render.yaml` is included for one-click deploy on Render. Add a `DATABASE_URL`
env var for durable storage; otherwise it uses local JSON files.

## ⚠️ Disclaimer

Demo software. Not a real medical service. Always consult a licensed professional and
call your local emergency number in an emergency.
