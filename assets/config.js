/* ==========================================================================
   EDIT HERE: every download link on the site lives in this one file.
   Leave a url as "" and the page shows "Coming soon" instead of a button.
   ========================================================================== */
window.SITE = {
  discord: "https://discord.gg/U35dt6Qb2A",

  anyps: {
    version: "",            // e.g. "1.0.0"
    downloadUrl: "",        // Google Drive share link to the AnyPS release .zip
    sizeLabel: "",          // e.g. "1.2 GB"
  },

  // Personal Vault: the owner's own backups. Keep each Drive file's sharing
  // set to "Restricted" so only the owner's Google account can open it.
  vault: {
    list: [
      { title: "Toy Story Retro Roundup", platform: "PC recomp", blurb: "Portable build with the PS1 additions, ultrawide and per-game rebinding.", url: "https://drive.google.com/file/d/1AhNaY8lvoET3-dZKeihm0D9-tHV44moa/view?usp=drive_link" },
      { title: "Dissidia Final Fantasy", platform: "PSP recomp", blurb: "Native PC builds of Dissidia and Duodecim 012.", url: "https://drive.google.com/file/d/1sh6hWeJC0vYFgE7hLLEo3iAJl1W4NNsD/view?usp=drive_link" },
      { title: "LET IT DIE", platform: "PC standalone", blurb: "Standalone build that runs without Steam, with the mod menus.", url: "https://drive.google.com/file/d/1YEXsUo37KMz2njtrTjz1K2qShEE2gwL4/view?usp=drive_link" },
    ],
  },
};
