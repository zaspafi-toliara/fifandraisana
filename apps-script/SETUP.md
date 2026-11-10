# Phase 2 – Connect the website to the Google Sheet

Do all steps while logged in to the **choir's Google account** (zaspafi.toliara601@gmail.com).

## 1. Create the Google Sheet

1. Go to Google Drive → **New → Google Sheets**. Name it `ZA SPaFI Toliara – Rakitra`.
2. In the sheet: **Extensions → Apps Script**.
3. Delete the content of `Code.gs` and paste the content of `apps-script/Code.gs`. Click **Save** (💾).
4. In the function list at the top, choose **`setup`** and click **Run**.
   Google asks for permission the first time: *Review permissions → choose the choir account → Advanced → Go to (project) → Allow*.
5. Go back to the sheet and reload it. The tabs are created, and a menu **ZA SPaFI** appears.

## 2. The tabs

| Tab | What to enter | Who |
|---|---|---|
| **Mpikambana** | One row per member: name, birth date, phone, commission, Birao (Eny/Tsia), board role, date joined, status, rights | Sekretera |
| **Latsakemboka** | One row per month paid: date paid, member ID, month (`2026-11`), amount | Mpitahiry vola |
| **Vola** | All other money in/out: date, Miditra/Mivoaka, amount, reason | Mpitahiry vola |
| **Fanomezana** | Filled automatically by the donation form. Change **Sata** to *Voamarina* after checking the MVola SMS (or *Nolavina* if not received) | Mpitahiry vola |
| **Fitaovana** | Inventory: material ID (e.g. `ZE-01`), type, description, size, condition | Vaomiera Fitaovana |
| **Fampindramana** | Loans: date, material ID, member ID; fill **Daty naverina** when returned | Vaomiera Fitaovana |
| **Tanjona** | Goals: ID (`T1`), title, description, deadline, Aseho (show on public site: Eny/Tsia) | Birao |
| **Asa** | Tasks = steps of goals: ID (`A1`), goal ID, task, person in charge (**member ID** like `ZA-004` **or** a commission name), deadline, status | Birao |
| **Fanatrehana** | Attendance: date, member ID, type of meeting | Sekretera |
| **Fikirana** | Settings: monthly fee, payment deadline day, opening balance | Mpitahiry vola |

**Important rules**

- **Do not** enter fees or donations in the **Vola** tab: they are added to the financial report automatically from **Latsakemboka** and **Fanomezana** (otherwise they are counted twice).
- A fee is "on time" when paid before day *X* of the following month (*X* = "Daty farany handoavana" in **Fikirana**, default 10).
- After adding new members, use the menu **ZA SPaFI → Hameno ID sy PIN tsy ampy**: it gives each new member an ID (`ZA-001`, `ZA-002`…) and a 4-digit PIN. Give each member their PIN privately.
- **Fikirana → Vola tany am-boalohany**: put the cash the association already has today, so the balance is correct.

## 3. Publish the web app

1. In Apps Script: **Deploy → New deployment**. Type: **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
2. Click **Deploy**, then copy the **Web app URL** (ends with `/exec`).
3. In the website folder, open `assets/js/config.js` and paste it:
   `API_URL: "https://script.google.com/macros/s/…/exec",`
4. Push the change to GitHub. The yellow "sample data" banner disappears and the site shows the Sheet's data.

**When `Code.gs` changes later**: Deploy → **Manage deployments** → ✏️ edit → Version: **New version** → Deploy. This keeps the same URL.

## 4. Security notes

- Only the Birao should have edit access to the Sheet. Members never need it: they use the website.
- PINs are stored in the **Mpikambana** tab, so anyone who can open the Sheet can see them. Keep the Sheet private.
- After 5 wrong PINs, login for that phone/ID is blocked for 15 minutes.
- A login lasts 6 hours, or until the member clicks **Hivoaka** or closes the browser.
- The public site only shows: goals and their steps (no names), confirmed donations (name hidden if the donor asked), and the Birao names. Birth dates and phone numbers are never sent to the website.

## Coming next (phase 3)

- Phone entry app for the Mpitahiry vola and Sekretera: QR scan of member cards and materials, transactions, fees, attendance, donation confirmation, offline mode
- Member cards with QR code
- Automatic SMS reminders via the Android gateway phone
