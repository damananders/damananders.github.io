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
          { name: "Grand Theft Auto: San Andreas", url: "https://drive.google.com/file/d/1ffm3NHJZvGqoYNlMeVw2DtVr2g3ysizy/view?usp=drive_link" },
          { name: "Bully", url: "https://drive.google.com/file/d/1XAVyOImVFcKBNidWeSz9R-knadcolKjq/view?usp=drive_link" },
          { name: "The Godfather", url: "https://drive.google.com/file/d/1Hty-k2lLIbMmzHCDpmEGlPIyVrWCVS7s/view?usp=drive_link" },
          { name: "The Simpsons: Hit & Run", url: "https://drive.google.com/file/d/1oEamgu8y7FhmGdAurUxJGlByqX4Vgmsj/view?usp=drive_link" },
          { name: "We Love Katamari", url: "https://drive.google.com/file/d/1doMCxKCBPI3xEFaxQ7RhTIBRV0DJ8_Sh/view?usp=drive_link" },
          { name: "SoulCalibur II", url: "https://drive.google.com/file/d/1iUVaGwbJMQ6IAHW70NJiAAL4ar1oRQq8/view?usp=drive_link" },
          { name: "SoulCalibur III", url: "https://drive.google.com/file/d/1hVroDEMj6m1suo-LIULgIkP_dEY6IsOK/view?usp=drive_link" },
          { name: "The Lord of the Rings: The Fellowship of the Ring", url: "https://drive.google.com/file/d/1x_1hSRiTniXR1ndYvIOpyO2515ahf8y1/view?usp=drive_link" },
          { name: "The Lord of the Rings: The Two Towers", url: "https://drive.google.com/file/d/1FOxIdL6jmdKPy3VSuKSI9qKdvAhPzq12/view?usp=drive_link" },
          { name: "The Lord of the Rings: The Return of the King", url: "https://drive.google.com/file/d/1iPTKkFIWcg7oe9v8O2xmN7RjVZNEMnzn/view?usp=drive_link" },
          { name: "The Lord of the Rings: The Third Age", url: "https://drive.google.com/file/d/1dp69I86cPwWAbcwEglvoRViauw1L488b/view?usp=drive_link" },
          { name: "Family Guy: The Video Game", url: "https://drive.google.com/file/d/1epMB0NqRXvYnC0Fhquc8rP_mpE8XoAJS/view?usp=drive_link" },
          { name: "The Fairly OddParents: Breakin' da Rules", url: "https://drive.google.com/file/d/1sIV4VUu_VQwS0Z_iOqb-OpwGYaTB0nI-/view?usp=drive_link" },
          { name: "Wrath Unleashed", url: "https://drive.google.com/file/d/1_c5-LdSXvUI9E0f91dpARgZWXZOrdl3C/view?usp=drive_link" },
          { name: "Whiplash", url: "https://drive.google.com/file/d/1x6QTBNMi_CFbkV0l5OLJfseu6pqAzuJW/view?usp=drive_link" },
          { name: "Disney's Meet the Robinsons", url: "https://drive.google.com/file/d/1mk6mfLAkrOmch4C1V7r4aMM0QdYYU9M9/view?usp=drive_link" },
          { name: "Wallace & Gromit in Project Zoo", url: "https://drive.google.com/file/d/1o2oJq-EaWtx6ZiYtRUBnd16It1jArvzC/view?usp=drive_link" },
          { name: "Wallace & Gromit: The Curse of the Were-Rabbit", url: "https://drive.google.com/file/d/1dIm85ERvPcRYcs7mrko490nayFErt40m/view?usp=drive_link" },
          { name: "Tom and Jerry: War of the Whiskers", url: "https://drive.google.com/file/d/1-g-hKxvX-85vjfujknnNBpAl12m8we2W/view?usp=drive_link" },
          { name: "Taz: Wanted", url: "https://drive.google.com/file/d/1U737VuPAYa6rr3Dlu9iCBR2x6xPqh7dK/view?usp=drive_link" },
          { name: "Tak and the Power of Juju", url: "https://drive.google.com/file/d/1KBYBwjDaRSC-3mz85mopAHGoYtsdQ615/view?usp=drive_link" },
          { name: "The Scorpion King: Rise of the Akkadian", url: "https://drive.google.com/file/d/1gZOcn-XLuPqyBOSFpxOFWAK5K-e80J-_/view?usp=drive_link" },
          { name: "Scooby-Doo! Unmasked", url: "https://drive.google.com/file/d/1DewNVHY4bLaPqczlys6DJG3pRDUwFKtS/view?usp=drive_link" },
          { name: "Scooby-Doo! Mystery Mayhem", url: "https://drive.google.com/file/d/1z2lHQYVmik_jfrD2tdeUQNCifcxPVSZk/view?usp=drive_link" },
          { name: "Scooby-Doo! First Frights", url: "https://drive.google.com/file/d/18cZzzKA1cw0xD7SPq0kI72GGaMQ0DJv7/view?usp=drive_link" },
          { name: "The Ant Bully", url: "https://drive.google.com/file/d/1vpWEJr1McFTY3z6jEoiwjIQ2h5NIaEwL/view?usp=drive_link" },
        ],
      },
      {
        id: "psp", name: "PSP", console: "PlayStation Portable", icon: "psp", mode: "list",
        blurb: "PSP backups, one link each.",
        entries: [
          { name: "Dissidia Final Fantasy (US)", url: "https://drive.google.com/file/d/1ycqR-dCmuIC5EzbCI3dtzpeGddaIsmhv/view?usp=drive_link" },
          { name: "Dissidia Final Fantasy (JP)", url: "https://drive.google.com/file/d/1J1keizIyVfBJG_JqbUMhDvgrNWSTcCe0/view?usp=drive_link" },
          { name: "Dissidia Final Fantasy (Universal Tuning)", url: "https://drive.google.com/file/d/1CgTPm-_rMlcyy_woiZ5FGN300PEVfg23/view?usp=drive_link" },
          { name: "Dissidia 012 [duodecim] Final Fantasy", url: "https://drive.google.com/file/d/1Nz6wOzk6bUt01AiVVySe5qbvqThmOKnJ/view?usp=drive_link" },
          { name: "SOCOM: U.S. Navy SEALs", url: "https://drive.google.com/file/d/1qTUOio8PZLHLB05v7TbiEY51__kSrvww/view?usp=drive_link" },
          { name: "LEGO Batman: The Videogame", url: "https://drive.google.com/file/d/1z41xR9nV04T2ckVodwfmkAzUBuikw2RJ/view?usp=drive_link" },
          { name: "Untold Legends: The Warrior's Code", url: "https://drive.google.com/file/d/1o3Z3rrFqu0nK8vunCgUtDlirX1DFez0v/view?usp=drive_link" },
          { name: "Untold Legends: Brotherhood of the Blade", url: "https://drive.google.com/file/d/1lzqf5TdlOD96EMkFs2s0J7-kSEu_jEAK/view?usp=drive_link" },
          { name: "Death Jr.", url: "https://drive.google.com/file/d/1mikGO56TQEKCBYpS4E-Ia0QepkBTr7EY/view?usp=drive_link" },
          { name: "Death Jr. II: Root of Evil", url: "https://drive.google.com/file/d/1RlSGOCO_49ISzhQfjJWt_bDAF1CXi4qk/view?usp=drive_link" },
          { name: "007: From Russia with Love", url: "https://drive.google.com/file/d/1xxFYsxMRwcy_cO7_r7mKez4IQeLv4Qw7/view?usp=drive_link" },
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
          { name: "LittleBigPlanet PS Vita", url: "https://drive.google.com/file/d/1vpoENN5MgpCHfF00OJn-iR9RVYqBaHUC/view?usp=drive_link" },
          { name: "Jak and Daxter Collection", url: "https://drive.google.com/file/d/1-9S2LQ8mpBH7mmhbIf0UKYfbv0e5W3od/view?usp=drive_link" },
          { name: "God of War Collection", url: "https://drive.google.com/file/d/1qNMp1h0yhdjW8u9WmF57FAMwaQ_l42c0/view?usp=drive_link" },
          { name: "Borderlands 2", url: "https://drive.google.com/file/d/1H630x--NCDm-iRjAixPRJilD1QhBq3zv/view?usp=drive_link" },
          { name: "Call of Duty: Black Ops Declassified", url: "https://drive.google.com/file/d/1CXOVTx82hbQb8ZRPyCueVWculwVZZ9H5/view?usp=drive_link" },
          { name: "Batman: Arkham Origins Blackgate", url: "https://drive.google.com/file/d/1CGAeQjNhS5R7QIoj5rkNNeJdldo0FhHm/view?usp=drive_link" },
          { name: "Disney Epic Mickey 2: The Power of Two", url: "https://drive.google.com/file/d/1uTv4-r3LTqc5zyXO3I_s5ISybnumYy_b/view?usp=drive_link" },
          { name: "Sid Meier's Civilization Revolution 2", url: "https://drive.google.com/file/d/15exIPmA7hNsExHMA0rim6Mif0wfauyIo/view?usp=drive_link" },
          { name: "Adventure Time", url: "https://drive.google.com/file/d/1q7EuM-qksVt2vOEA7BIMsHB2M_3PyB8y/view?usp=drive_link" },
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
