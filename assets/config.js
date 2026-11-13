/* ==========================================================================
   EDIT HERE: every download link on the site lives in this one file.
   Leave a url as "" and the page shows "Coming soon" instead of a button.
   ========================================================================== */
window.SITE = {
  discord: "https://discord.gg/U35dt6Qb2A",

  anyps: {
    version: "2.1",
    date: "2026-11-12",
    downloadUrl: "https://drive.google.com/file/d/1O5PrRaR56RP8d5SN9ixTLRW4U6U-C_Kw/view?usp=sharing",
    // AnyPS.exe on its own (about 1 MB). AnyPS's built-in updater (Settings > AnyPS version) downloads THIS,
    // compares "version" above with the installed one, and swaps itself. Any Google Drive share link works.
    // Leave "" and the updater falls back to pulling AnyPS.exe out of the full zip at downloadUrl.
    exeUrl: "https://damananders.github.io/anyps/AnyPS.exe",
    sizeLabel: "281 MB",    // e.g. "903 MB"
    // 32-bit Windows edition (PSP only). Leave download32Url "" to hide the link on the page.
    download32Url: "https://drive.google.com/file/d/1hd1W0whJiq3s7Fypmg4lrHr6IsltnCFs/view?usp=sharing",
    version32: "1.05.1",
    size32Label: "17 MB",
    // Older releases, newest first. Add the outgoing build here when you publish a new one.
    oldBuilds: [
      { version: "1.05.1", date: "2026-11-11", url: "https://drive.google.com/file/d/1MMoMYCjYH7DGZf5JfJ5rlremEIPUDxdA/view?usp=sharing" },
      { version: "1.05", date: "2026-11-11", url: "https://drive.google.com/file/d/1Iz70eZ_8fQJ56GWuUZlDVe711DCgwCAV/view?usp=sharing" },
      { version: "1.04", date: "2026-11-10", url: "https://drive.google.com/file/d/1oeCnn8dW4SxLYS06BmRO3eHZlAhLptHq/view?usp=sharing" },
      { version: "1.03", date: "2026-11-09", url: "https://drive.google.com/file/d/1itBtMN1IkazBL4QoQWw6OjtXVeEyff9n/view?usp=sharing" },
      { version: "1.02", date: "2026-11-08", url: "https://drive.google.com/file/d/122nRFK2tS5vmbod39q3jqMwcT89RAVm_/view?usp=drive_link" },
      { version: "1.0", date: "2026-11-07", url: "https://drive.google.com/file/d/1WTz6VA1pCxiSANa9F9x6i9o4d-274HyM/view?usp=drive_link" },
    ],
  },

  // Personal Vault: the owner's own backups. Keep each Drive file's sharing
  // set to "Restricted" so only the owner's Google account can open it.
  // icon: "star" | "crystal" | "skull" | "disc" (see ICONS in vault/index.html)
  vault: {
    list: [
      { title: "Toy Story Retro Roundup", icon: "star", platform: "PC recomp", blurb: "Portable build with the PS1 additions, ultrawide and per-game rebinding.", url: "https://drive.google.com/file/d/1AhNaY8lvoET3-dZKeihm0D9-tHV44moa/view?usp=drive_link" },
      { title: "Dissidia Final Fantasy", icon: "crystal", platform: "PSP recomp", blurb: "Native PC builds of Dissidia and Duodecim 012.", url: "https://drive.google.com/file/d/1sh6hWeJC0vYFgE7hLLEo3iAJl1W4NNsD/view?usp=drive_link" },
      { title: "LET IT DIE", icon: "skull", platform: "PC standalone", blurb: "Standalone build that runs without Steam, with the mod menus.", url: "https://drive.google.com/file/d/1YEXsUo37KMz2njtrTjz1K2qShEE2gwL4/view?usp=drive_link" },
    ],
  },
};
