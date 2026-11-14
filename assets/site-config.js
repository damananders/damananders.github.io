/* Site settings for the hub and its pages. Safe to edit by hand.
 *
 * NOTE: assets/config.js is a different file. The AnyPS app's built-in updater reads it,
 * so it stays exactly as the AnyPS release process writes it. Everything new lives here.
 * Blank values mean "feature stays hidden until filled in".
 */
window.SITE_EXTRA = {
  /* ---- Social header buttons ---- */
  twitch: {
    channel: "damananders_ttv",
    // "auto" asks a public lookup whether the channel is live. true / false forces it.
    live: "auto",
  },
  discord: {
    invite: "U35dt6Qb2A",   // the code at the end of the invite link
    showCount: true,        // member count on the Discord button
  },
  kofi: {
    url: "https://ko-fi.com/damananders",
    // Goal bar. Hidden until BOTH numbers are filled in, e.g. current: 40, target: 100.
    goal: { title: "Help pay for website costs!", current: 0, target: 75, currency: "$" },   // monthly; update "current" as support comes in
  },

  /* ---- AndersCraft ---- */
  anderscraft: {
    // Read-only status endpoint: drives the Online/Offline pip on each realm card (and, if the
    // endpoint also returns counts/leaderboard, those widgets). Blank = those stay hidden.
    // Served by status.php next to the sign-up service on the same ngrok tunnel; the realm pips
    // appear once it answers and go quiet if the PC/tunnel is down (same as the sign-up pip).
    statusUrl: "https://banish-amends-useable.ngrok-free.dev/status.php",
    // Only used by the hub card's "Sign-ups open" chip. Keep the same as apiUrl in anderscraft/index.html.
    apiUrl: "https://banish-amends-useable.ngrok-free.dev/register.php",
  },

  /* ---- AnyPS ---- */
  anyps: {
    // SHA-256 of the files behind the download buttons. Blank = no checksum line is shown.
    sha256: "",
    sha256_32: "",
    // GitHub repo that hosts AnyPS releases, as "owner/name". Blank = Drive links from config.js are used
    // and the download counter stays hidden.
    githubRepo: "",
  },

  /* ---- Personal Vault ---- */
  vault: {
    // Optional cosmetic passphrase. Put the SHA-256 (hex) of your phrase here to turn the gate on.
    // It only hides the page from casual visitors; the real protection is Drive's Restricted sharing.
    passphraseSha256: "",
    // The Vault card is hidden on the hub until this browser has opened the site once with ?owner
    hideOnHub: true,
  },

  /* ---- PS Locker (/locker/, reached with a code from the hidden mark at the bottom of the hub) ----
     My own backups, shown as a little "store". Keep every Drive item on "Restricted" sharing: that is the real lock.

     HOW IT WORKS
       Each entry in `categories` is one shelf in the store (BIOS, PS1, PS2, ...). The front page shows a card
       per category with its blurb and stats; clicking a card opens that category's page.
       A category is one of two kinds:
         mode:"pack" — ONE download that contains many games (that's how PS1 is stored). The category page shows
                       the single download button plus a browsable list of every game inside, with info on each.
         mode:"list" — each game/dump is uploaded SEPARATELY, so it's its own clickable download. Use this for
                       BIOS, PS2, PSP, PS3, Vita. Each entry can carry its own DLC list.
       Fields:
         id       short slug used in the URL (?c=ps2) — keep it stable once linked.
         name     shelf title shown on the card and page.
         console  small label under the title (e.g. "PlayStation 2").
         icon     one of: bios, ps1, ps2, psp, ps3, vita, disc, handheld (just picks the drawing).
         blurb    one or two sentences on what this shelf is.
         size     total download size as text ("42 GB"); used for the stat and for sorting. Optional for lists
                  (it'll add up the entries' sizes instead).
         url      pack mode only: the one Drive link for the whole pack.
         games[]  pack mode: { name, year, region, genre, note, dlc:[{name}] }  (name is required)
         entries[] list mode: { name, url, size, year, region, genre, note, dlc:[{name, url, size}] }
         added    optional date on any game/entry ("2026-11-13"): shows a NEW badge for ~3 weeks and a
                  dot on the shelf card. The storefront also shows a whole-library tally (titles + size).
       DLC names are auto-cleaned on screen, so you can paste the raw package name (serial numbers and
       [BRACKETED] codes are stripped to a readable title). url:"" anywhere = shows "Link not added yet".
       Downloads shown on the cards are a private per-browser tally of your own opens — handy, not analytics. */
  locker: {
    intro: "My own system files and game backups, kept off-site so I can pull them back from anywhere. Private shelves — pick one to browse.",
    categories: [
      {
        id: "bios", name: "System Files", console: "BIOS & Firmware", icon: "bios", mode: "list",
        blurb: "BIOS and firmware dumped from my own consoles. Needed to boot the games in an emulator.",
        entries: [
          { name: "PlayStation BIOS set", size: "2 MB", note: "PS1 region BIOS (SCPH-xxxx).", url: "https://drive.google.com/file/d/1GVubmlchUBJHizTVjjkYwlXVXw7xcC1p/view?usp=sharing" },
          // Add PS2 / PSP / PS3 / Vita firmware dumps here, each its own link:
          // { name: "PS2 BIOS set", size: "4 MB", note: "...", url: "https://drive.google.com/file/d/.../view?usp=sharing" },
        ],
      },
      {
        id: "ps1", name: "PlayStation 1", console: "PlayStation", icon: "ps1", mode: "pack",
        blurb: "My PS1 library in one archive. Download the pack, then everything below is inside it.",
        size: "", // total pack size, e.g. "40 GB"
        url: "https://drive.google.com/file/d/1jCCjTKj4cLumR0Q2f-NyTntzVBwJfBL5/view?usp=sharing",
        games: [
          // Edit this to match what's actually in the pack (name is all that's required):
          { name: "Crash Bandicoot", year: 1996, region: "NTSC-U", genre: "Platformer" },
          { name: "Spyro the Dragon", year: 1998, region: "NTSC-U", genre: "Platformer" },
          { name: "Final Fantasy VII", year: 1997, region: "NTSC-U", genre: "RPG", note: "3 discs." },
          { name: "Metal Gear Solid", year: 1998, region: "NTSC-U", genre: "Stealth", note: "2 discs." },
          { name: "Gran Turismo 2", year: 1999, region: "NTSC-U", genre: "Racing" },
          { name: "Resident Evil 2", year: 1998, region: "NTSC-U", genre: "Survival Horror", note: "2 discs." },
          { name: "Tony Hawk's Pro Skater 2", year: 2000, region: "NTSC-U", genre: "Sports" },
          { name: "Castlevania: Symphony of the Night", year: 1997, region: "NTSC-U", genre: "Metroidvania" },
        ],
      },
      {
        id: "ps2", name: "PlayStation 2", console: "PlayStation 2", icon: "ps2", mode: "list",
        blurb: "PS2 backups, each uploaded on its own so you can grab just what you want.",
        entries: [
          // { name: "Shadow of the Colossus", size: "4 GB", year: 2005, region: "NTSC-U", genre: "Action", url: "", note: "" },
        ],
      },
      {
        id: "psp", name: "PSP", console: "PlayStation Portable", icon: "psp", mode: "list",
        blurb: "PSP backups, one link each.",
        entries: [
          // { name: "Patapon", size: "500 MB", year: 2008, region: "NTSC-U", genre: "Rhythm", url: "", note: "" },
        ],
      },
      {
        id: "ps3", name: "PlayStation 3", console: "PlayStation 3", icon: "ps3", mode: "list",
        blurb: "PS3 backups with their DLC, one link each.",
        entries: [
          // Paste the raw package name for DLC — serial codes get cleaned up on screen automatically:
          // { name: "LittleBigPlanet", size: "6 GB", year: 2008, region: "NTSC-U", genre: "Platformer", url: "",
          //   dlc: [ { name: "LBP_COSTUME_PACK_UP9000-NPUB30000_00", size: "80 MB", url: "" } ] },
        ],
      },
      {
        id: "vita", name: "PS Vita", console: "PlayStation Vita", icon: "vita", mode: "list",
        blurb: "Vita backups, one link each.",
        entries: [
          // { name: "Persona 4 Golden", size: "3 GB", year: 2012, region: "NTSC-U", genre: "RPG", url: "", note: "" },
        ],
      },
    ],
  },

  /* ---- Resume / "work with me" ----
     The footer link on the landing page opens a "Send Your Contact Info?" box, then takes visitors to /resume/.
     contactEndpoint: where the optional name/email/phone are sent. A Formspree form works out of the box
       (https://formspree.io/f/XXXX). Blank = the box still works but nothing is sent (visitors just head in).
     linkedin / github: shown as links on the resume. pdfUrl: a downloadable copy of the resume; blank = hidden. */
  resume: {
    contactEndpoint: "https://formspree.io/f/xdavyjdd",
    linkedin: "",   // removed from the page at the owner's request
    github: "https://github.com/damananders",
    pdfUrl: "",
  },

  /* ---- Other channels. Each one with a link shows as a small badge in the footer of every page. Blank = hidden. ---- */
  channels: {
    youtube: "https://www.youtube.com/@DaManAnders",
    tiktok: "",
    x: "",
    instagram: "https://www.instagram.com/damananders/",
    bluesky: "",
  },

  /* ---- Retro visitor counter in the footer. It only counts page opens; no cookies, nothing about the visitor is stored.
     provider "abacus" uses the free abacus.jasoncameron.dev counter. provider "" hides the counter. ---- */
  counter: { provider: "abacus", namespace: "damananders-hub", key: "visits" },

  /* ---- Analytics (privacy friendly, no cookies). Your GoatCounter site code, e.g. "damananders". Blank = off. ---- */
  analytics: { goatcounter: "damananders" },

  /* ---- Feature switches. Set any to false to turn that effect off for everyone. ---- */
  features: {
    typing: true,        // typing headline on the hub
    parallax: true,      // background drifts with the pointer and scroll
    tilt: true,          // 3D tilt + glare on the avenue cards
    glow: true,          // slow accent glow pulse on the cards
    particles: true,     // ambient particles on the hub
    dayNight: true,      // hub tint follows the visitor's local time
    ticker: true,        // "latest update" ticker on the hub
    nowCard: true,       // "now building / now playing" card on the hub
    cursorRing: true,    // custom cursor ring (desktop only)
    transitions: true,   // page-to-page transitions
    soundscape: true,    // optional waves-and-wind soundscape on the hub (always starts muted)
    uiSounds: true,      // optional UI sounds (always start off)
    konami: true,        // easter egg
  },
};
