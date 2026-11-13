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

### 5.7 Fee year, fixed fees, arrival times (update of November 2026)

After replacing `Code.gs`: run **`setup`** once, then **Manage deployments → New version**. `setup` adds:

- **Mpikambana → Sokajy** (last column): choose **Mpianatra** (student) or **Miasa** (employed) for every member.
- **Fikirana**: new rows (existing values are kept)
  - `Latsakemboka mpianatra` = 1000, `Latsakemboka miasa` = 2000 → the fee is taken from here according to **Sokajy**. In the phone app the amount is shown but cannot be changed.
  - `Ora fiandohan'ny fivoriana` = 14:00 → **put the real start time of your meetings**.
  - `Fahatarana azo leferina (minitra)` = 10 → arrivals after start time + this number of minutes count as late.
- **Fanatrehana**: the third column becomes **Ora tonga** (arrival time, filled automatically by the scan). Old rows keep their old text; they count as "present" without a time.

**Fee year**: October → August (11 months, no September). September already shows the next year. The fee calendar, the rankings and the attendance report all follow this year.

**Arrivals ("Fahatongavana mivory")**: in the phone app, each scan records the date and the time of the phone. Only the first arrival of the day counts. Members see their own summary; the Birao sees the full report (presence, on time, late, average arrival time) at the bottom of the members' page.

### 5.8 Installing both apps on the same phone

- `fampidirana.html` and `mpikambana.html` are now two separate apps.
- If you installed **Fampidirana** before this update: remove it from the home screen first (long press → Uninstall), open `fampidirana.html` again in Chrome → ⋮ → **Install app / Add to Home screen**.
- Then open `mpikambana.html` → ⋮ → **Install app**. Both icons appear: "Fampidirana" and "ZA SPaFi".

### 5.9 Photos

The photo box now has two buttons: **📷 Haka sary** opens the camera directly, **🖼 Hisafidy sary** opens the gallery.

### 5.10 Rights (update of November 2026, part 2)

After replacing `Code.gs`: run **`setup`** once (it adds **Sata** and **ID** to **Vola**, **Vaomiera** to **Asa**, and the new right in the **Zo** list), then **Manage deployments → New version**.

| Who | Phone app (fampidirana) | Members' page |
|---|---|---|
| **Mpitahiry vola** (Zo or Andraikitra Birao) | Income/expenses and fees (counted immediately), **confirm** donations and the Sekretera's income/expenses and fees | everything |
| **Sekretera** (Zo, or Andraikitra "Sekretera …") | Income/expenses and fees (**both wait for the Mpitahiry vola's confirmation** before entering the report / the fee calendar) | everything |
| **Birao (Birao = Eny) and Zo = Mpandrindra** | Arrivals at meetings, loans/returns, member photos, card printing | + add goals, add tasks for any commission, Birao reports |
| **Vaomiera Fitaovana** | Loans and returns of materials only | add tasks for Fitaovana |
| **Zo = Mpandray fahatongavana** (new) | Scan arrivals at meetings only | – |
| Every member | – | see everything; add tasks for **their own** commission; mark their tasks done |

- The **Mpandrindra** cannot enter income/expenses or fees, and cannot confirm donations.
- In the **Vola** and **Latsakemboka** tabs, rows with **Sata = Miandry** are not counted in the financial report; **Nolavina** = rejected. Old rows (empty Sata) count as confirmed.
- Tasks added from the website get an ID (A1, A2…), the commission in **Vaomiera**, and "Nampiditra: name" in **Fanamarihana**. Goals added by the Birao get T1, T2…

### 5.11 Phone "back" button

In both apps, the phone's back button now returns to the previous screen (or closes the camera / the profile panel) instead of closing the app.

### 5.12 SMS sent by hand and invitation form

After replacing `Code.gs`: run **`setup`** once (it creates the **Fanasana** tab), then **Manage deployments → New version**. Google asks again for permissions (sending email for the invitation confirmations): accept.

**Members' page – Birao and Mpandrindra**
- **Hampandrenesana amin'ny SMS**: choose *Fivoriana*, *Hamonjy antsam-panahy* (then fill *Fanamiana lahy* / *Fanamiana vavy*) or *Hafa* (then write the reason), fill *Toerana*, *Andro*, *Ora* → **Alefa** → check the message and the number of members → **Alefa amin'ny mpikambana …**. Every active member with a phone number receives it.
- Long messages (over 160 characters) are sent as 2 SMS per person: keep the place and uniform texts short.
- Under each task not yet done: **Mandefa fampahatsiahivana** sends the reminder now to the person or to every member of the commission in charge.

**Phone app – Birao, Mpandrindra, Vaomiera Fitaovana**
- New tile **Fitaovana mbola tsy naverina**: the list of materials still held, by member. 📩 next to an item, **Hampahatsiahy azy** for one member (one SMS naming all their items), or **Hampahatsiahy ny rehetra**. Also available on a material's screen. Needs internet.

Every SMS sent is recorded in **Tantara**.

**Invitation page** – `https://<account>.github.io/<repository>/fanasana.html`
- Share this link on Facebook/WhatsApp. It is also on the home page ("Handefa fanasana aminay") and in the menu.
- Visitors fill: name, association/group, phone, email (optional), subject, and upload the letter (PDF or photo, 8 MB max).
- The letter is saved in the **private** Drive folder "ZA SPaFi Toliara – Fanasana" of the choir account; a row is added to **Fanasana** with the link (Sata = *Vaovao*). Change Sata to *Eken'ny Birao*, *Nolavina* or *Vita* when handled.
- *(Replaced by 5.13: the visitor now only sees "Misaotra betsaka!".)*

### 5.13 Invitation alerts, new members, broadcast rights, completed goals (update of November 2026, part 3)

After replacing `Code.gs`: run **`setup`** once (it adds two rows to **Fikirana**), then **Manage deployments → New version**.

**Fikirana – two new rows**
- **Fifandraisana mandray fanasana (ID)**: the member ID (e.g. `ZA-007`) of the Vaomiera Fifandraisana person who must be told about new invitations. Leave empty to notify the Birao only.
- **Mailaka fikambanana**: the email that receives invitations (default `zaspafi.toliara601@gmail.com`).

**Invitations**
- The visitor no longer receives an SMS or email: the "Misaotra betsaka!" screen is the confirmation.
- Each new invitation sends one SMS to every Birao member (Birao = *Eny*) and to the Fifandraisana contact above, and an email with the letter link to the association email.

**New members (phone app – Birao and Mpandrindra)**
- Tile **Mpikambana vaovao** in *Firaketana an-tsoratra*: fill name, phone, commission, category (and birth date / joining date if known) → save.
- The new **ID** and **PIN** are shown once: press **Adikao ny hafatra** to copy a ready message and send it to the person. The PIN is also in the **Mpikambana** tab.
- A phone number already in the list is refused (the existing member is named). Needs internet.

**SMS announcements (Hampandrenesana amin'ny SMS)**
- Now only Vaomiera **Fifandraisana** members and members with Zo = **Mpandrindra** see this block. The Birao no longer does unless they are in one of these.
- Task reminder buttons stay with the Birao and Mpandrindra.

**Completed goals**
- A goal whose steps are all done no longer appears among the goal cards. It is listed by name only (number of steps and completion date) under **Ireo asa vita** on the home page and members' page.
