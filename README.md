# Archive

A private archive for your kaiju world: factions, places, history, stories and a map.
It runs in the browser, works offline once installed, and keeps everything on your device.
No account, no server, nobody else can see your world.

## Put it online with GitHub Pages

1. On github.com, create a new **public** repository, for example `archive`.
2. Open the repository, choose **Add file → Upload files**, and drag in everything from this folder
   (`index.html`, `app.css`, `sw.js`, `manifest.webmanifest`, and the `js` and `icons` folders).
   Then press **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, pick **Deploy from a branch**,
   branch **main**, folder **/ (root)**, and press **Save**.
4. After a minute or two the app is live at `https://YOUR-NAME.github.io/archive/`.

Only the app's code is public. Your entries, images and map never leave your device.

## Install it on your phone

Open the link in Chrome or Samsung Internet, open the browser menu and choose
**Install app** (or **Add to Home screen**). From then on it opens like a normal app and works without internet.

## Your data

- Everything is saved on the device you're using. Your phone and your computer each have their own copy;
  they don't sync by themselves.
- **Backup and restore** (in the menu) saves one file with all entries, settings, the map and every image.
  The app reminds you when your last backup is more than a week old.
- To move your world to another device, save a backup there and restore it on the other device.
  Restoring replaces everything on that device.

## Good to know

- **Links:** in any text, type `#` and pick an entry from the bar above the keyboard.
  Writing `#Name#` yourself works too. While editing, links look like `#Maximus#`; when you save,
  the hashes disappear and the name becomes a link. A `#Name#` that doesn't exist yet shows up dashed;
  tap it to create that entry.
- **Lore tab:** everything that isn't a being, a place or an event. Under **Lore** go groups (like a religion
  or a slayer faction), technology, concepts and whatever categories you add. Under **Items** go weapons,
  armor, tools and so on. Groups can have members: open a character's edit page and pick the group under
  **Member of**. Give an item an owner and it shows up as gear on that character's page.
- **Author mode** (the eye at the top) shows hidden meters, secret notes, what really happened in history,
  and who is a Tamer. Turn it off to see the world the way its historians know it.
- **Settings** lets you rename or add factions, types, kaiju classes, slayer ranks, families, elements,
  sins, place types, lore categories, item types, eras and meters, including calculated meters like
  Dominance and Willpower.
- **Map:** upload any image as the base map. Public-domain world maps from Wikimedia Commons work well,
  or your own drawing.

## Updating the app later

Replace the files in the repository with the new ones. If `sw.js` has a new `VERSION`,
installed copies pick up the update the next time the app is opened (sometimes it takes a second open).
