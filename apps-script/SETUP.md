# Phase 2 – Connect the website to the Google Sheet

Do all steps while logged in to the **choir's Google account** (zaspafi.toliara601@gmail.com).

## 1. Create the Google Sheet

1. Go to Google Drive → **New → Google Sheets**. Name it `ZA SPaFi Toliara – Rakitra`.
2. In the sheet: **Extensions → Apps Script**.
3. Delete the content of `Code.gs` and paste the content of `apps-script/Code.gs`. Click **Save** (💾).
4. In the function list at the top, choose **`setup`** and click **Run**.
   Google asks for permission the first time: *Review permissions → choose the choir account → Advanced → Go to (project) → Allow*.
5. Go back to the sheet and reload it. The tabs are created, and a menu **ZA SPaFi** appears.

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
- After adding new members, use the menu **ZA SPaFi → Hameno ID sy PIN tsy ampy**: it gives each new member an ID (`ZA-001`, `ZA-002`…) and a 4-digit PIN. Give each member their PIN privately.
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

## 5. Phase 3 – phone entry app, cards, SMS reminders

### 5.1 Update the script (once)

1. Open the Sheet → **Extensions → Apps Script**. Replace the whole content of `Code.gs` with the new `apps-script/Code.gs`. Save.
2. **Project Settings** (⚙️) → Time zone: **(GMT+03:00) Antananarivo**.
3. Run **`setup`** again. It adds the **Tantara** tab (history of every entry made from the phone) and the meeting list in **Fanatrehana**. Nothing already entered is changed. Accept the new permissions (sending SMS through the internet, daily trigger).
4. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** The URL stays the same.

### 5.2 Who can use the phone app (`fampidirana.html`)

Set the **Zo** column in **Mpikambana**:

| Zo | Fees, income/expenses, confirm donations | Loans & returns | Attendance |
|---|---|---|---|
| Mpitahiry vola, Sekretera, Mpandrindra | ✓ | ✓ | ✓ |
| Members of Vaomiera **Fitaovana** | | ✓ | |
| Others | – | – | – |

On the phone: open `https://…/fampidirana.html`, log in once (phone/ID + PIN). The phone stays logged in for 30 days.
In Chrome, menu ⋮ → **Add to Home screen**: it then opens like an app, even without internet.

**Without internet**: entries are kept on the phone ("Fampidirana X miandry halefa") and sent automatically when the connection comes back. Do not log out while entries are waiting.

### 5.3 Cards and labels (`karatra.html`)

1. Log in on `fampidirana.html` first (same browser).
2. Open **Hanonta karatra** → choose members (or a commission) → **Hanonta**. A4, 10 cards per page (85.6 × 54 mm, bank-card size).
3. Tab **Etikety fitaovana** prints QR labels for uniforms and materials (stick them inside the uniform or on a sewn tag).
4. Tip: print on thick paper (200–250 g) and laminate.

Each member also sees their own card with its QR code in the members' area (**Ny momba ahy**).

### 5.4 SMS reminders (spare Android phone)

1. On the spare phone (with the dedicated SIM and an SMS bundle): install **SMS Gateway for Android** (https://sms-gate.app).
2. In the app: switch on **Cloud server**, then **Online**. Note the **Username** and **Password** it shows.
3. Android settings → Apps → SMS Gateway → Battery: **Unrestricted** (otherwise Android stops it at night). Keep the phone charged and connected to the internet (mobile data or Wi-Fi).
4. In the Sheet: menu **ZA SPaFi → SMS: ampidiro ny kaonty SMS Gateway** → enter the username and password.
5. **ZA SPaFi → SMS: andramo** → enter your number → you should receive a test SMS.
6. **ZA SPaFi → SMS: alefaso isan'andro ny fampahatsiahivana** → every day around 8:00 the script checks the **Asa** tab.

Who receives what (tasks not marked **Vita**):

| When | Message |
|---|---|
| *N* days before the deadline (*N* = "Fampahatsiahivana (andro mialoha)" in **Fikirana**, default 3) | Reminder with the deadline |
| On the deadline day | "Androany no fe-potoana…" |
| The day after | "Tara ny asa…" |

If the person in charge is a member ID (`ZA-004`), only that member receives it. If it is a commission (`Fitaovana`), every active member of that commission receives it. Each reminder is sent only once (recorded in **Tantara**). Maximum 60 SMS per day.

The SMS cost is the normal cost of the SIM card in the gateway phone.

### 5.5 Member photos on the cards

1. Replace `Code.gs` again with the new version, run **`setup`** once (it adds the **Sary** column at the end of **Mpikambana**), accept the new permission (Google Drive), then **Manage deployments → New version**.
2. Photos can be added two ways:
   - **Phone entry app** (Sekretera / Mpitahiry vola): open a member → **Sary → Haka na hisafidy sary** → take the photo or choose one from the gallery → **Tehirizina ny sary**. Works offline too; it is sent with the other entries.
   - **Members' area**: each member can use **Hanova ny sariko** under their card (needs internet).
3. The photo is cropped automatically to a portrait (3:4) and reduced to a small file (~40 KB). It is saved in the Drive folder **"ZA SPaFi Toliara – Sary mpikambana"** of the choir account and its file ID is written in **Sary**. The old photo goes to the Drive bin.
4. Photos are visible to anyone who has the link (needed for the website and the cards). Do not move the folder or change the files' sharing.

Good photo: face in the centre, plain light background, daylight, no strong shadow. Members without a photo show their initials on the card.

### 5.6 Hidden goals and tasks

- **Tanjona → Aseho = Tsia**: the goal is not shown on the public site, only in the members' area (marked "Tsy aseho amin'ny besinimaro").
- **Asa → Aseho = Tsia** (new column at the end, added by running `setup` again): that step is hidden from the public site but visible to members.
- After replacing `Code.gs`: run `setup` once, then **Manage deployments → New version**.
