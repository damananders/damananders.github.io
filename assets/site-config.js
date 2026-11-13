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
    goal: { title: "Help me survive this harsh world and keep building", current: 0, target: 15, currency: "$" },   // monthly; update "current" as support comes in
  },

  /* ---- AndersCraft ---- */
  anderscraft: {
    // Read-only status endpoint (player counts, leaderboard). Blank = those widgets stay hidden.
    statusUrl: "",
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
     Paste your private Drive links here. Keep those Drive items on "Restricted" sharing: that is the real lock. */
  locker: {
    list: [
      { title: "System files (BIOS)", note: "BIOS and firmware dumped from my own consoles.", url: "https://drive.google.com/file/d/1GVubmlchUBJHizTVjjkYwlXVXw7xcC1p/view?usp=sharing" },
      { title: "PS1 games", note: "Backups of games I own.", url: "https://drive.google.com/file/d/1jCCjTKj4cLumR0Q2f-NyTntzVBwJfBL5/view?usp=sharing" },
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
  analytics: { goatcounter: "" },

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
