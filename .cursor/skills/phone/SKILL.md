---
name: phone
description: Start a live preview of the app on a real phone over the local network with a QR code. Use when the user says "/phone", "phone preview", or wants to test the mobile UI on their iPhone.
---

# /phone: live preview on a real phone

1. From `capitals-app/`, run `npm run dev:phone` in the background.
2. Read the terminal output and tell the user the printed URL (`http://<mac-ip>:5173/`). The QR code is in the terminal for them to scan.
3. The phone must be on the same Wi-Fi as the Mac. Vite hot-reloads on every save.
4. If the user's phone is unavailable (for example Screen Time downtime), use the `/shots` skill instead.
5. Stop the server when the user is done.
