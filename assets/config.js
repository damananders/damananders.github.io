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

  games: {
    // Link to the whole catalogue folder on Google Drive (optional).
    driveFolderUrl: "",
    // One entry per game. status: "ready" | "beta" | "soon"
    list: [
      // { title: "Example Game", platform: "PSP", blurb: "One line about it.", status: "beta", url: "https://drive.google.com/..." },
    ],
  },
};
