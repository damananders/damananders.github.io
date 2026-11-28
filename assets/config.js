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

  // AndersMod Studio (andersmod/): leave downloadUrl "" to show "Coming soon".
  // Upload the zip (Google Drive "Anyone with the link", or another host), paste its link here.
  andersmod: {
    version: "0.7.2",
    date: "2026-11-26",
    // GitHub Release asset. It only works once the v0.7.2 release exists with this exact file attached.
    downloadUrl: "https://github.com/damananders/AndersLiveModStudio/releases/download/v0.7.2/AndersModStudio-0.7.2-public.zip",
    releasesUrl: "https://github.com/damananders/AndersLiveModStudio/releases",
    host: "Hosted on GitHub", // shown next to the button
    sizeLabel: "58 MB",
    sha256: "24b203a41c685f34a923f14e357cabd688806eb0e56e75ae163dd99550d34a94",   // of AndersModStudio-0.7.2-public.zip
  },

  // Ramses (ramses/): leave downloadUrl "" to show "Coming soon".
  ramses: {
    version: "1.0.4",
    date: "2026-11-28",
    // GitHub Release asset (v1.0.4 is live; checksum verified against the uploaded file).
    downloadUrl: "https://github.com/damananders/Ramses/releases/download/v1.0.4/Ramses-1.0.4-win-x64.zip",
    releasesUrl: "https://github.com/damananders/Ramses/releases/tag/v1.0.4",
    host: "Hosted on GitHub",
    sizeLabel: "64 MB",
    sha256: "bdc1f4dee7377e9677449e31223903135fec793fed531a4822554175e66550c2",   // of Ramses-1.0.4-win-x64.zip
  },

  // DMA Web Studio (webstudio/): leave downloadUrl "" to show "Coming soon". Source is private; releases only.
  webstudio: {
    version: "0.1.0",
    date: "2026-11-26",
    downloadUrl: "https://github.com/damananders/DMAWebStudio/releases/download/v0.1.0/DMAWebStudio-0.1.0-win-x64.zip",
    releasesUrl: "https://github.com/damananders/DMAWebStudio/releases/tag/v0.1.0",
    host: "Hosted on GitHub",
    sizeLabel: "73 MB",
    sha256: "ff8d5b8297d106c9402652b13350eb24a8afb35c3d409b7509008d1d5a191a5e",   // of DMAWebStudio-0.1.0-win-x64.zip
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
