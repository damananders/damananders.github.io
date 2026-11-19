/* play.js — the playful layer, loaded on every page by assets/interact.js (prefix pl-).
 *
 *   1. Trophies       small achievements for exploring the site; a cup button in the tool rail lists them.
 *                     Site.trophy("id") awards one. Stored per browser. features.trophies
 *   2. Secret codes   type a word anywhere (not in a text box) to trigger an effect. features.secretCodes
 *                     australia, gravity, moon, barrelroll, crt, disco, matrix
 *   3. Controller     press Y, B, A, X (triangle, circle, cross, square) in a row. features.padCombo
 *   4. Boot intro     hub only, once per browser session, skippable. features.intro
 *
 * Everything moving is skipped when motion is reduced; trophies still work.
 */
(function () {
  "use strict";
  if (!window.Site || window.__plLoaded) return;
  window.__plLoaded = true;
  var Site = window.Site, el = Site.el, svg = Site.svg, doc = document, root = doc.documentElement;
  function feat(name) { var f = (Site.config && Site.config.features) || {}; return f[name] !== false; }

  /* ====================================================================================================
   * 1. Trophies
   * ==================================================================================================== */
  /* Each trophy carries a `rarity` reflecting the effort/time to earn it: common · uncommon · rare · epic ·
     legendary. The two capstones override it — id "all" shows as "platinum", the admin one as "special". */
  var TROPHIES = [
    { id: "hello",     name: "Player One",        desc: "Showed up. That's the first step.", rarity: "common" },
    { id: "explorer",  name: "Cartographer",      desc: "Visited the hub, AndersCraft, AnyPS, the ratings and the résumé.", rarity: "uncommon" },
    { id: "theme",     name: "Night Shift",       desc: "Flipped between the dark and light themes.", rarity: "common" },
    { id: "settings",  name: "Tinkerer",          desc: "Opened the settings panel.", rarity: "common" },
    { id: "bottom",    name: "Rock Bottom",       desc: "Scrolled a page all the way down.", rarity: "common" },
    { id: "share",     name: "Word of Mouth",     desc: "Used the share button.", rarity: "common" },
    { id: "dj",        name: "Sea Breeze",        desc: "Turned on the soundscape.", rarity: "common" },
    { id: "hire",      name: "Headhunter",        desc: "Opened the 'work with me' box.", rarity: "common" },
    { id: "card",      name: "Due Diligence",     desc: "Opened a project card on the résumé.", rarity: "common" },
    { id: "lost",      name: "Off the Map",       desc: "Found the 404 page.", secret: true, rarity: "uncommon" },
    { id: "door",      name: "Knock Knock",       desc: "Found the hidden door.", secret: true, rarity: "uncommon" },
    { id: "key",       name: "Keymaster",         desc: "Got through the hidden door.", secret: true, rarity: "rare" },
    { id: "konami",    name: "Old School",        desc: "Entered a very famous cheat code.", secret: true, rarity: "rare" },
    { id: "australia", name: "Down Under",        desc: "Turned the whole site upside down.", secret: true, rarity: "rare" },
    { id: "codes",     name: "Codebreaker",       desc: "Discovered three different secret words.", secret: true, rarity: "rare" },
    { id: "combo",     name: "Button Masher",     desc: "Pulled off the controller combo.", secret: true, rarity: "rare" },
    { id: "sailor",    name: "Old Salt",          desc: "Scored 300 or more in the boat game on the lost page.", secret: true, rarity: "rare" },
    { id: "boat1k",    name: "Steady Hand",       desc: "Scored 1,000 or more in the boat game on the lost page.", secret: true, rarity: "epic" },
    { id: "boat5k",    name: "Master Mariner",    desc: "Scored 5,000 or more in the boat game on the lost page.", secret: true, rarity: "legendary" },
    { id: "rs-easy",   name: "First Stamp",       desc: "Beat Easy in the Review Score game.", secret: true, rarity: "uncommon" },
    { id: "rs-medium", name: "Getting Critical",  desc: "Beat Medium in the Review Score game.", secret: true, rarity: "rare" },
    { id: "rs-hard",   name: "Tough Critic",      desc: "Beat Hard in the Review Score game.", secret: true, rarity: "epic" },
    { id: "rs-harder", name: "Harsh Reviewer",    desc: "Beat Harder ;) in the Review Score game.", secret: true, rarity: "epic" },
    { id: "rs-harderer", name: "Ruthless",        desc: "Beat the hidden Harder…er in the Review Score game.", secret: true, rarity: "legendary" },
    { id: "menu",      name: "Navigator",         desc: "Opened the page menu.", rarity: "common" },
    { id: "deepcuts",  name: "Deep Cuts",         desc: "Visited Links I Like, the stream page, Uses and What's New.", rarity: "uncommon" },
    { id: "forum",     name: "Town Square",       desc: "Dropped by the Wiki-Chip Dex forums.", rarity: "common" },
    { id: "linkout",   name: "Link Hopper",       desc: "Visited a site from Links I Like.", rarity: "common" },
    { id: "voter",     name: "Have Your Say",     desc: "Voted on a site in Links I Like.", rarity: "common" },
    { id: "rop-rate1", name: "First Opinion",     desc: "Rated a game on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-rate10", name: "Warming Up",       desc: "Rated 10 games on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-rate25", name: "Critic in Training", desc: "Rated 25 games on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-rate50", name: "Regular Reviewer", desc: "Rated 50 games on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-rate100", name: "Seasoned Critic",  desc: "Rated 100 games on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-rate250", name: "Veteran Critic",  desc: "Rated 250 games on Wiki-Chip Dex.", rarity: "epic" },
    { id: "rop-rate500", name: "Encyclopedist",    desc: "Rated 500 games on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-rate1000", name: "Librarian",      desc: "Rated 1,000 games on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-review", name: "Wordsmith",         desc: "Wrote a review on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-review10", name: "Prolific Critic", desc: "Wrote 10 reviews on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-review25", name: "Essayist",       desc: "Wrote 25 reviews on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-list",  name: "Curator",           desc: "Made a game list on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-list5", name: "List Maker",        desc: "Made 5 game lists on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-follow", name: "Following the Crowd", desc: "Followed a member on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-follow10", name: "Well Connected", desc: "Followed 10 members on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "classic",   name: "Lighthouse Keeper", desc: "Switched the site to its Classic skin.", rarity: "common" },
    { id: "seasons",   name: "Four Seasons",      desc: "Tried the fall, winter, spring and summer skins.", rarity: "uncommon" },
    { id: "skinmaster", name: "Dressed to Impress", desc: "Tried the Classic skin and all four seasonal skins.", rarity: "uncommon" },
    { id: "access",    name: "Easy Reader",       desc: "Tried an accessibility option.", rarity: "common" },
    { id: "access-all", name: "Fully Loaded",     desc: "Tried the text-size, contrast and reading-font options.", rarity: "uncommon" },
    { id: "shortcuts", name: "Shortcut Artist",   desc: "Opened the keyboard shortcut map.", rarity: "common" },
    { id: "room",      name: "Window Shopper",    desc: "Looked through the trophy list.", rarity: "common" },
    { id: "regular",   name: "Regular",           desc: "Came back on three different days.", rarity: "uncommon" },
    { id: "days7",     name: "One Week In",       desc: "Came back on seven different days.", rarity: "uncommon" },
    { id: "days14",    name: "Fortnight Fan",     desc: "Came back on fourteen different days.", secret: true, rarity: "rare" },
    { id: "weekend",   name: "Weekend Warrior",   desc: "Visited on a weekend.", rarity: "common" },
    { id: "streak",    name: "On a Roll",         desc: "Came back three days in a row.", secret: true, rarity: "rare" },
    { id: "streak7",   name: "Week-Long Streak",  desc: "Came back seven days in a row.", secret: true, rarity: "epic" },
    { id: "miss5",     name: "Unfivetunately",    desc: "Typed five wrong codes into the hidden door.", secret: true, rarity: "rare" },
    { id: "nightowl",  name: "Night Owl",         desc: "Visited between midnight and four in the morning.", secret: true, rarity: "rare" },
    { id: "earlybird", name: "Early Bird",        desc: "Visited between five and seven in the morning.", secret: true, rarity: "rare" },
    { id: "nightandday", name: "Round the Clock", desc: "Dropped in both late at night and early in the morning.", secret: true, rarity: "rare" },
    { id: "warcraft",  name: "Realm Keeper",      desc: "Found the AndersCraft client stashed in the Locker.", secret: true, rarity: "rare" },
    { id: "offsite",   name: "Off-Site Backup",   desc: "Grabbed one of the backups from the Locker.", secret: true, rarity: "rare" },
    { id: "twodoors",  name: "Lockpick",          desc: "Got through both hidden doors — the Vault and the Locker.", secret: true, rarity: "rare" },
    { id: "v-hub",     name: "Home Base",         desc: "Landed on the hub.", rarity: "common" },
    { id: "v-craft",   name: "Realm Visitor",     desc: "Visited the AndersCraft page.", rarity: "common" },
    { id: "v-anyps",   name: "Console Cowboy",    desc: "Visited the AnyPS page.", rarity: "common" },
    { id: "v-games",   name: "Browsing the Shelves", desc: "Visited Wiki-Chip Dex.", rarity: "common" },
    { id: "v-resume",  name: "The Pitch",         desc: "Opened the résumé.", rarity: "common" },
    { id: "v-links",   name: "Link Library",      desc: "Visited Links I Like.", rarity: "common" },
    { id: "v-stream",  name: "Now Streaming",     desc: "Visited the stream page.", rarity: "common" },
    { id: "v-uses",    name: "Toolbox Peek",      desc: "Visited the Uses page.", rarity: "common" },
    { id: "v-changelog", name: "Patch Reader",    desc: "Visited What's New.", rarity: "common" },
    { id: "v-trophies", name: "Trophy Room",      desc: "Visited the trophy cabinet.", rarity: "common" },
    { id: "v-account", name: "Account Page",      desc: "Visited the account page.", rarity: "common" },
    { id: "v-projects", name: "What's Cooking",   desc: "Visited the What I'm Working On page.", rarity: "common" },
    { id: "arcade",    name: "Insert Coin",       desc: "Dropped by the arcade.", rarity: "common" },
    { id: "support",   name: "Keeping the Lights On", desc: "Stopped by the support page.", rarity: "common" },
    { id: "clubhouse", name: "Found the Clubhouse", desc: "Visited the Discord page.", rarity: "common" },
    { id: "seeyou",    name: "See You There",     desc: "Followed the invite to the Discord server.", rarity: "uncommon" },
    { id: "shareall",  name: "Spread the Word",   desc: "Used the share button and followed the Discord invite.", rarity: "uncommon" },
    { id: "acct",      name: "Got an Account",    desc: "Signed in with a DaManAnders account.", rarity: "common" },
    { id: "acct-discord", name: "Linked Up",      desc: "Linked your Discord to your account.", rarity: "common" },
    { id: "acct-dma",  name: "Native Account",    desc: "Set up a native DaManAnders account.", rarity: "common" },
    { id: "acct-handle", name: "Name Claimed",    desc: "Claimed your @handle.", rarity: "uncommon" },
    { id: "acct-verified", name: "Verified",      desc: "Confirmed your account.", rarity: "uncommon" },
    { id: "acct-flair", name: "Flaired Up",       desc: "Earned a profile flair.", rarity: "uncommon" },
    { id: "acct-supporter", name: "Supporter",    desc: "Became a Supporter.", rarity: "rare" },
    { id: "acct-avatar", name: "New Look",        desc: "Set a profile avatar.", rarity: "uncommon" },
    { id: "acct-motto", name: "Words to Live By", desc: "Set a profile motto.", rarity: "common" },
    { id: "acct-status", name: "Status Update",   desc: "Set a profile status.", rarity: "common" },
    { id: "acct-bio",  name: "About Me",          desc: "Wrote a profile bio.", rarity: "common" },
    { id: "acct-pronouns", name: "Introductions", desc: "Added your pronouns.", rarity: "common" },
    { id: "acct-now",  name: "Now Playing",       desc: "Set what you're now playing.", rarity: "common" },
    { id: "acct-accent", name: "True Colors",     desc: "Picked a profile accent color.", rarity: "common" },
    { id: "dancefever", name: "Dance Fever",      desc: "Started the disco.", secret: true, rarity: "rare" },
    { id: "redpill",   name: "Red Pill",          desc: "Followed the white rabbit into the matrix.", secret: true, rarity: "rare" },
    { id: "snowday",   name: "Snow Day",          desc: "Made it snow.", secret: true, rarity: "rare" },
    { id: "barrel",    name: "Do a Barrel Roll",  desc: "Did a barrel roll.", secret: true, rarity: "rare" },
    { id: "freefall",  name: "Free Fall",         desc: "Messed with the site's gravity.", secret: true, rarity: "rare" },
    { id: "tubelife",  name: "Tube Life",         desc: "Switched on CRT mode.", secret: true, rarity: "rare" },
    { id: "aesthetic", name: "Aesthetic",         desc: "Went full vaporwave.", secret: true, rarity: "rare" },
    { id: "screensaver", name: "Screen Saver",    desc: "Tried CRT mode, the matrix and vaporwave.", secret: true, rarity: "rare" },
    { id: "topsyturvy", name: "Topsy Turvy",      desc: "Flipped the site with both Australia and a barrel roll.", secret: true, rarity: "uncommon" },
    { id: "codes5",    name: "Word Wizard",       desc: "Discovered five different secret words.", secret: true, rarity: "rare" },
    { id: "fulldeck",  name: "Full Deck",         desc: "Discovered every secret word on the site.", secret: true, rarity: "epic" },
    { id: "themehop",  name: "Can't Decide",      desc: "Flipped the theme five times.", secret: true, rarity: "uncommon" },
    { id: "themehop10", name: "Truly Indecisive", desc: "Flipped the theme ten times.", secret: true, rarity: "rare" },
    { id: "pj-vote",   name: "I Approve",         desc: "Upvoted a project on the What I'm Working On page.", rarity: "common" },
    { id: "pj-vote3",  name: "Hype Man",          desc: "Upvoted three different projects.", rarity: "uncommon" },
    { id: "pj-comment", name: "Two Cents",        desc: "Commented on a project.", rarity: "common" },
    { id: "pj-reply",  name: "Good Point",        desc: "Replied to a comment on a project.", rarity: "common" },
    { id: "halfway",   name: "Halfway There",     desc: "Earned half of all the trophies.", rarity: "rare" },
    { id: "collect5",  name: "Getting Started",   desc: "Earned five trophies.", rarity: "common" },
    { id: "collect10", name: "Shelf Space",       desc: "Earned ten trophies.", rarity: "common" },
    { id: "collect20", name: "Collector",         desc: "Earned twenty trophies.", rarity: "uncommon" },
    { id: "collect30", name: "Trophy Hunter",     desc: "Earned thirty trophies.", rarity: "uncommon" },
    { id: "collect40", name: "Shelf Filler",      desc: "Earned forty trophies.", rarity: "uncommon" },
    { id: "collect50", name: "Half Cabinet",      desc: "Earned fifty trophies.", rarity: "rare" },
    { id: "collect60", name: "Dedicated",         desc: "Earned sixty trophies.", rarity: "rare" },
    { id: "collect75", name: "So Close",          desc: "Earned seventy-five trophies.", secret: true, rarity: "epic" },
    { id: "collect90", name: "Obsessed",          desc: "Earned ninety trophies.", secret: true, rarity: "epic" },
    { id: "collect100", name: "Centurion",        desc: "Earned one hundred trophies.", secret: true, rarity: "legendary" },
    { id: "grandtour", name: "Grand Tour",        desc: "Visited every page in the menu.", secret: true, rarity: "epic" },
    { id: "rop-rate5", name: "Second Opinion", desc: "Rated 5 games on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-rate75", name: "Sharp Eye", desc: "Rated 75 games on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-rate150", name: "Hard to Impress", desc: "Rated 150 games on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-rate750", name: "Human Metacritic", desc: "Rated 750 games on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-rate2000", name: "The Archivist", desc: "Rated 2,000 games on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-review5", name: "Getting Wordy", desc: "Wrote 5 reviews on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-review50", name: "Columnist", desc: "Wrote 50 reviews on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-review75", name: "Staff Writer", desc: "Wrote 75 reviews on Wiki-Chip Dex.", rarity: "epic" },
    { id: "rop-review100", name: "Critic Laureate", desc: "Wrote 100 reviews on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-list3", name: "Shortlist", desc: "Made 3 game lists on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-list10", name: "Listmaniac", desc: "Made 10 game lists on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-list25", name: "Master Curator", desc: "Made 25 game lists on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-list50", name: "The Librarian's Librarian", desc: "Made 50 game lists on Wiki-Chip Dex.", secret: true, rarity: "epic" },
    { id: "rop-follow5", name: "Making Friends", desc: "Followed 5 members on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-follow25", name: "Social Butterfly", desc: "Followed 25 members on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-follow50", name: "Pillar of the Community", desc: "Followed 50 members on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-follow100", name: "Everybody Knows Your Name", desc: "Followed 100 members on Wiki-Chip Dex.", secret: true, rarity: "epic" },
    { id: "collect15", name: "Growing Collection", desc: "Earned fifteen trophies.", rarity: "common" },
    { id: "collect25", name: "Quarter Shelf", desc: "Earned twenty-five trophies.", rarity: "uncommon" },
    { id: "collect35", name: "Steady Hauler", desc: "Earned thirty-five trophies.", rarity: "uncommon" },
    { id: "collect45", name: "Cabinet Maker", desc: "Earned forty-five trophies.", rarity: "uncommon" },
    { id: "collect55", name: "Over the Hump", desc: "Earned fifty-five trophies.", rarity: "rare" },
    { id: "collect70", name: "Seventy Strong", desc: "Earned seventy trophies.", rarity: "rare" },
    { id: "collect85", name: "Deep Shelf", desc: "Earned eighty-five trophies.", rarity: "epic" },
    { id: "collect110", name: "Past the Hundred", desc: "Earned one hundred and ten trophies.", secret: true, rarity: "epic" },
    { id: "collect125", name: "Half the Cabinet", desc: "Earned one hundred and twenty-five trophies.", secret: true, rarity: "epic" },
    { id: "collect150", name: "Three Fifths", desc: "Earned one hundred and fifty trophies.", secret: true, rarity: "legendary" },
    { id: "collect175", name: "The Home Stretch", desc: "Earned one hundred and seventy-five trophies.", secret: true, rarity: "legendary" },
    { id: "collect200", name: "Double Century", desc: "Earned two hundred trophies.", secret: true, rarity: "legendary" },
    { id: "collect225", name: "Almost Everything", desc: "Earned two hundred and twenty-five trophies.", secret: true, rarity: "legendary" },
    { id: "collect240", name: "So, So Close", desc: "Earned two hundred and forty trophies.", secret: true, rarity: "legendary" },
    { id: "days30", name: "Monthly Regular", desc: "Came back on thirty different days.", rarity: "rare" },
    { id: "days50", name: "Half-Century Fan", desc: "Came back on fifty different days.", secret: true, rarity: "epic" },
    { id: "days100", name: "Hundred Days", desc: "Came back on one hundred different days.", secret: true, rarity: "legendary" },
    { id: "days200", name: "Resident", desc: "Came back on two hundred different days.", secret: true, rarity: "legendary" },
    { id: "streak14", name: "Two-Week Streak", desc: "Came back fourteen days in a row.", secret: true, rarity: "epic" },
    { id: "streak30", name: "Unbroken Month", desc: "Came back thirty days in a row.", secret: true, rarity: "legendary" },
    { id: "lunch", name: "Lunch Break", desc: "Dropped in around midday.", secret: true, rarity: "common" },
    { id: "teatime", name: "Teatime", desc: "Dropped in in the mid-afternoon.", secret: true, rarity: "common" },
    { id: "primetime", name: "Prime Time", desc: "Dropped in in the evening.", secret: true, rarity: "common" },
    { id: "witching", name: "Witching Hour", desc: "Here as the clock struck midnight.", secret: true, rarity: "rare" },
    { id: "dayparts", name: "Round the Clock Club", desc: "Visited in the morning, afternoon, evening and dead of night.", secret: true, rarity: "epic" },
    { id: "newyear", name: "Auld Lang Syne", desc: "Rang in the new year here.", secret: true, rarity: "rare" },
    { id: "valentines", name: "Secret Admirer", desc: "Visited on Valentine's Day.", secret: true, rarity: "rare" },
    { id: "aprilfool", name: "No Foolin'", desc: "Visited on April Fools' Day.", secret: true, rarity: "rare" },
    { id: "halloween", name: "Trick or Treat", desc: "Visited on Halloween.", secret: true, rarity: "rare" },
    { id: "blackfriday", name: "Doorbuster", desc: "Visited the day after US Thanksgiving.", secret: true, rarity: "rare" },
    { id: "yuletide", name: "Yuletide", desc: "Visited on Christmas Day.", secret: true, rarity: "rare" },
    { id: "leapday", name: "Leap of Faith", desc: "Visited on a leap day.", secret: true, rarity: "legendary" },
    { id: "themehop25", name: "Flip-Flopper", desc: "Flipped the theme twenty-five times.", secret: true, rarity: "rare" },
    { id: "comfyreader", name: "Comfy Reader", desc: "Turned on reduced motion and the reading font.", rarity: "uncommon" },
    { id: "calmwaters", name: "Calm Waters", desc: "Turned on reduced motion.", rarity: "common" },
    { id: "textbig", name: "Big Print", desc: "Bumped up the text size.", rarity: "common" },
    { id: "highcontrast", name: "High Contrast", desc: "Turned on high contrast.", rarity: "common" },
    { id: "readfont", name: "Easy on the Eyes", desc: "Switched on the reading font.", rarity: "common" },
    { id: "comfort", name: "Creature Comforts", desc: "Turned on the soundscape and reduced motion.", rarity: "uncommon" },
    { id: "accessible", name: "Accessible All Round", desc: "Tried reduced motion and every reading aid.", rarity: "rare" },
    { id: "settler", name: "Putting Down Roots", desc: "Fifty trophies and thirty days visited.", secret: true, rarity: "epic" },
    { id: "regular-critic", name: "Regular at the Dex", desc: "Fifty ratings and ten reviews in.", rarity: "rare" },
    { id: "v-explore", name: "Tourist", desc: "Visited the Explore page.", rarity: "common" },
    { id: "faithful", name: "Faithful Patron", desc: "Stopped by Support with seven days on the books.", rarity: "uncommon" },
    { id: "cardcarrier", name: "Card-Carrying Member", desc: "Visited the Discord page and followed the invite.", rarity: "uncommon" },
    { id: "v-dash", name: "Dashboard Diver", desc: "Found the live dashboard.", secret: true, rarity: "uncommon" },
    { id: "tourguide", name: "Guided Tour", desc: "Toured the Explore page and the Deep Cuts.", rarity: "uncommon" },
    { id: "homebody", name: "Knows Every Room", desc: "Visited every page that has its own visit trophy.", secret: true, rarity: "epic" },
    { id: "globetrotter", name: "Seen It All", desc: "Finished the Grand Tour and the Deep Cuts.", rarity: "rare" },
    { id: "projectfan", name: "Project Scout", desc: "Opened three different project cards.", rarity: "uncommon" },
    { id: "acct-complete", name: "Fully Furnished", desc: "Filled in every part of your profile.", rarity: "rare" },
    { id: "acct-early", name: "Charter Member", desc: "Set up a native account, claimed a handle and got verified.", rarity: "rare" },
    { id: "acct-decorated", name: "Decorated", desc: "Earned a flair and became a Supporter.", secret: true, rarity: "epic" },
    { id: "acct-social", name: "Plugged In", desc: "Signed in, linked Discord and claimed your handle.", rarity: "uncommon" },
    { id: "bottom10", name: "Marathon Scroller", desc: "Reached the bottom of ten different pages.", rarity: "uncommon" },
    { id: "share3", name: "Megaphone", desc: "Used the share button three times.", rarity: "uncommon" },
    { id: "curious", name: "Curious Cat", desc: "Opened the menu, the settings, the shortcut map and the trophy list.", rarity: "uncommon" },
    { id: "firstsecret", name: "First Secret", desc: "Earned your first hidden trophy.", secret: true, rarity: "uncommon" },
    { id: "prankster", name: "Prankster", desc: "Messed with gravity, a barrel roll, the disco, the matrix and the snow.", secret: true, rarity: "epic" },
    { id: "secretagent", name: "Secret Agent", desc: "Set off every on-screen effect the secret words can trigger.", secret: true, rarity: "legendary" },
    { id: "soundvision", name: "Sound and Vision", desc: "Ran the soundscape, CRT mode and full vaporwave.", secret: true, rarity: "rare" },
    { id: "chameleon", name: "Chameleon", desc: "Wore both themes, the Classic skin and all four seasons.", rarity: "uncommon" },
    { id: "insomniac", name: "Insomniac", desc: "Here as a night owl, an early bird and at the witching hour.", secret: true, rarity: "epic" },
    { id: "truecritic", name: "The Real Critic", desc: "Rated a hundred games, wrote twenty-five reviews and made five lists.", rarity: "epic" },
    { id: "ratingmachine", name: "Rating Machine", desc: "Rated five hundred games and wrote fifty reviews.", secret: true, rarity: "legendary" },
    { id: "peopleperson", name: "People Person", desc: "Followed ten members, wrote a review and made a list.", rarity: "uncommon" },
    { id: "socialite", name: "Socialite", desc: "Followed twenty-five members, hit the forums and joined the Discord.", rarity: "rare" },
    { id: "longhauler", name: "Long Hauler", desc: "Fifty days in, with a two-week streak behind you.", secret: true, rarity: "epic" },
    { id: "weekendregular", name: "Weekend Regular", desc: "A weekend visit and seven days on the books.", rarity: "uncommon" },
    { id: "grinder", name: "No Days Off", desc: "A hundred days visited and a hundred trophies earned.", secret: true, rarity: "legendary" },
    { id: "mapmaker", name: "Here Be Dragons", desc: "A Cartographer who also finished the Grand Tour.", rarity: "rare" },
    { id: "welcomewagon", name: "Welcome Wagon", desc: "Signed in, set an avatar and wrote a motto.", rarity: "common" },
    { id: "supporterplus", name: "True Believer", desc: "A verified Supporter.", rarity: "rare" },
    { id: "themefan", name: "Wardrobe Change", desc: "Flipped the theme ten times and tried every skin.", rarity: "uncommon" },
    { id: "dawndusk", name: "Dawn and Dusk", desc: "Here at first light and again in the evening.", secret: true, rarity: "rare" },
    { id: "wordofmouth", name: "Town Crier", desc: "Shared the site, voted on a link and joined the Discord.", rarity: "uncommon" },
    { id: "bookworm", name: "Bookworm", desc: "A hundred ratings, with lists and reviews to match.", secret: true, rarity: "epic" },
    { id: "allrarities", name: "One of Each", desc: "Hold a Common, Uncommon, Rare, Epic and Legendary trophy at once.", secret: true, rarity: "epic" },
    { id: "halfsecret", name: "Shadow Collector", desc: "Uncovered twenty hidden trophies.", secret: true, rarity: "epic" },
    { id: "earlyriser", name: "Morning Person", desc: "An early bird who dropped in for lunch and teatime too.", secret: true, rarity: "rare" },
    { id: "deepdiver", name: "Deep Diver", desc: "Found the dashboard, the Explore tour and every secret door.", secret: true, rarity: "legendary" },
    { id: "patronsaint", name: "Keeping Us Afloat", desc: "A Supporter who stopped by the Support page.", rarity: "rare" },
    { id: "firstweek", name: "Settling In", desc: "Five days in with ten trophies on the shelf.", rarity: "uncommon" },
    { id: "nightshifter", name: "Burning Oil", desc: "A night owl with a seven-day streak.", secret: true, rarity: "epic" },
    { id: "completokraut", name: "The Long Game", desc: "Two hundred trophies and two hundred days.", secret: true, rarity: "legendary" },
    { id: "jackofall", name: "Jack of All Trades", desc: "Rated, reviewed, listed, followed and posted on the forums.", rarity: "rare" },
    { id: "showoff", name: "Show-Off", desc: "A full profile, a claimed handle and a flair to boot.", secret: true, rarity: "epic" },
    { id: "collect65", name: "Two Thirds Up", desc: "Earned sixty-five trophies.", rarity: "rare" },
    { id: "collect95", name: "Knocking on 100", desc: "Earned ninety-five trophies.", secret: true, rarity: "epic" },
    { id: "collect135", name: "Past the Middle", desc: "Earned one hundred and thirty-five trophies.", secret: true, rarity: "legendary" },
    { id: "collect160", name: "Two Thirds of 250", desc: "Earned one hundred and sixty trophies.", secret: true, rarity: "legendary" },
    { id: "collect190", name: "The Final Push", desc: "Earned one hundred and ninety trophies.", secret: true, rarity: "legendary" },
    { id: "collect210", name: "Running the Table", desc: "Earned two hundred and ten trophies.", secret: true, rarity: "legendary" },
    { id: "rop-rate300", name: "Opinionated", desc: "Rated 300 games on Wiki-Chip Dex.", rarity: "epic" },
    { id: "rop-review15", name: "Three on the Board", desc: "Wrote 15 reviews on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "friday13", name: "Bad Luck", desc: "Visited on a Friday the 13th.", secret: true, rarity: "rare" },
    { id: "piday", name: "Pi Day", desc: "Visited on the fourteenth of March.", secret: true, rarity: "rare" },
    { id: "may4", name: "May the Fourth", desc: "Visited on the fourth of May.", secret: true, rarity: "rare" },
    { id: "newmonth", name: "New Month, New Me", desc: "Dropped in on the first of a month.", secret: true, rarity: "uncommon" },
    { id: "allnighter", name: "All-Nighter", desc: "A night owl at the witching hour, three days running.", secret: true, rarity: "legendary" },
    { id: "tastemaker", name: "Tastemaker", desc: "Rated 250 games and followed 25 members.", secret: true, rarity: "epic" },
    { id: "veteran", name: "Old Timer", desc: "Fifty days in, with fifty trophies on the shelf.", secret: true, rarity: "epic" },
    { id: "devotee", name: "Devotee", desc: "A hundred days and a hundred and fifty trophies.", secret: true, rarity: "legendary" },
    { id: "penpal", name: "Pen Pal", desc: "Fifty reviews and twenty-five members followed.", secret: true, rarity: "epic" },
    { id: "decorator", name: "Interior Decorator", desc: "Flipped the theme and tried the Classic skin.", rarity: "common" },
    { id: "homesteader", name: "Homesteader", desc: "Landed on the hub, AndersCraft and AnyPS all in one trip.", rarity: "uncommon" },
    { id: "the-full-dex", name: "The Full Dex", desc: "Rated, reviewed, listed, followed, posted and claimed a handle.", secret: true, rarity: "legendary" },
    { id: "all",       name: "Completionist",     desc: "Earned every other trophy.", rarity: "platinum" },
    /* special: sits below Completionist, never counts toward it, and is only given to members Anders has made
       an Admin in Discord. The Wiki-Chip Dex pages confirm that with the server and emit "rop:admin". */
    { id: "special",   name: "Super Duper Special", desc: "Reserved for the people Anders has made an Admin in Discord.", special: true, rarity: "special" }
  ];
  var CORE = TROPHIES.filter(function (t) { return !t.special; });
  var RARITY = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", platinum: "Platinum", special: "Special" };
  var RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, platinum: 5, special: 6 };
  function rarOf(t) { return t.special ? "special" : (t.id === "all" ? "platinum" : (t.rarity || "common")); }
  var CUP = '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.2a2.6 2.6 0 0 0 2.9 3.6M16 5.5h2.8a2.6 2.6 0 0 1-2.9 3.6M12 13v3.5M8.5 20h7M9.5 20c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>';
  var LOCK = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  var QMARK = '<path d="M9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.8.4-1.5 1-1.5 2v.6"/><circle cx="11.5" cy="17.5" r="1.1" fill="currentColor" stroke="none"/>';
  var got = Site.store.get("trophies", {}) || {};
  var queue = [], showing = false, cupBtn = null, cupCount = null;

  function count() { var n = 0; CORE.forEach(function (t) { if (got[t.id]) n++; }); return n; }
  function paintCup() { if (cupCount) cupCount.textContent = count() + "/" + CORE.length; if (cupBtn) cupBtn.classList.toggle("pl-cup--special", !!got.special); }
  function nextPop() {
    if (showing || !queue.length || !doc.body) return;
    showing = true;
    var t = queue.shift();
    var pop = el("div", { class: "pl-trophy" + (t.special ? " pl-trophy--special" : ""), role: "status" },
      el("span", { class: "pl-trophy__ico" }, svg(CUP)),
      el("span", { class: "pl-trophy__txt" }, el("small", { text: "Trophy earned" }), el("strong", { text: t.name }), el("span", { text: t.desc })));
    doc.body.appendChild(pop);
    try { if (pop.showPopover) { pop.setAttribute("popover", "manual"); pop.showPopover(); } } catch (e) {}
    Site.sfx("success");
    requestAnimationFrame(function () { pop.classList.add("is-in"); });
    setTimeout(function () { pop.classList.remove("is-in"); setTimeout(function () { pop.remove(); showing = false; nextPop(); }, 420); }, 4200);
  }
  /* a gold shower for the big one (Completionist). Self-contained; motion-gated. */
  function celebrate() {
    if (Site.reducedMotion || !doc.body) return;
    var cv = el("canvas", { class: "pl-plat", "aria-hidden": "true" }), ctx = null;
    try { ctx = cv.getContext("2d"); } catch (e) {}
    if (!ctx) return;
    doc.body.appendChild(cv);
    try { if (cv.showPopover) { cv.setAttribute("popover", "manual"); cv.showPopover(); } } catch (e) {}
    var GOLD = ["#ffd86b", "#ffbf3f", "#fff2c2", "#e9a93a", "#ffffff"];
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = 0, H = 0, parts = [], raf = 0, last = 0, elapsed = 0, TOTAL = 5000, FADE = 900, done = false;
    function size() { W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    function burst() {
      var n = Math.max(40, Math.min(120, Math.round(W / 10)));
      for (var i = 0; i < n; i++) {
        var side = i % 2 ? 1 : -1;
        parts.push({ x: side < 0 ? -8 : W + 8, y: H * (0.78 + Math.random() * 0.14),
          vx: -side * (260 + Math.random() * 720), vy: -(520 + Math.random() * 640),
          w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10,
          c: GOLD[(Math.random() * GOLD.length) | 0], round: Math.random() < 0.3 });
      }
    }
    function frame(t) {
      raf = 0; if (done || doc.hidden) return;
      var dt = last ? Math.min(40, t - last) : 16.7; last = t; elapsed += dt;
      if (elapsed >= TOTAL) { stop(); return; }
      var s = dt / 1000, damp = Math.exp(-1.6 * s);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.vx *= damp; p.vy = p.vy * damp + 640 * s; p.r += p.vr * s; p.x += p.vx * s; p.y += p.vy * s;
        if (p.y > H + 40) { parts.splice(i, 1); continue; }
        var c = Math.cos(p.r) * dpr, sn = Math.sin(p.r) * dpr;
        ctx.setTransform(c, sn, -sn, c, p.x * dpr, p.y * dpr); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w * 0.5, 0, 6.2832); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      if (elapsed > TOTAL - FADE) cv.style.opacity = String(Math.max(0, (TOTAL - elapsed) / FADE));
      if (!parts.length && elapsed > 1400) { stop(); return; }
      raf = requestAnimationFrame(frame);
    }
    function resume() { if (!done && !doc.hidden && !raf) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (done) return; done = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener("resize", size); doc.removeEventListener("visibilitychange", resume); cv.remove(); }
    size(); burst(); setTimeout(burst, 360);
    window.addEventListener("resize", size); doc.addEventListener("visibilitychange", resume); resume();
  }

  function award(id) {
    if (!feat("trophies") || got[id]) return false;
    var t = null; TROPHIES.forEach(function (x) { if (x.id === id) t = x; });
    if (!t) return false;
    got[id] = Date.now(); Site.store.set("trophies", got); paintCup();
    queue.push(t); setTimeout(nextPop, 350);
    if (Site.emit) Site.emit("trophy:earned", { id: id, at: got[id] });   /* cross-device sync (assets/sync.js) listens */
    if (id === "all") setTimeout(celebrate, 500);
    if (id !== "all" && !t.special && !got.all && count() === CORE.length - 1) setTimeout(function () { award("all"); }, 600);
    return true;
  }
  Site.trophy = award;
  /* Cross-device sync hooks (assets/sync.js). merge() folds in trophies earned on another device with no toasts,
     keeping the earliest timestamp per trophy; it never removes one. all() hands back the current set to push up. */
  Site.trophy.all = function () { return got; };
  Site.trophy.merge = function (remote) {
    if (!remote || typeof remote !== "object") return got;
    var changed = false;
    Object.keys(remote).forEach(function (id) {
      var ts = +remote[id] || 0; if (!ts) return;
      if (!got[id]) { got[id] = ts; changed = true; }
      else if (ts < got[id]) { got[id] = ts; changed = true; }
    });
    if (changed) { Site.store.set("trophies", got); paintCup(); }
    return got;
  };

  function openList() {
    var pos = {}; TROPHIES.forEach(function (t, i) { pos[t.id] = i; });
    var list = el("ul", { class: "pl-list" });
    var state = { sort: "rarity", filter: "all" };   /* sort + filter are toggleable from the popup */

    function sorted() {
      var arr = TROPHIES.slice();
      if (state.sort === "name") {
        arr.sort(function (a, b) {
          /* hidden secret trophies (unearned) sort to the end so their real names never leak order */
          var an = (a.secret && !got[a.id]) ? "￿" : a.name.toLowerCase();
          var bn = (b.secret && !got[b.id]) ? "￿" : b.name.toLowerCase();
          return an < bn ? -1 : an > bn ? 1 : pos[a.id] - pos[b.id];
        });
      } else if (state.sort === "earned") {
        arr.sort(function (a, b) {
          var ag = got[a.id] || 0, bg = got[b.id] || 0;
          if (ag && !bg) return -1;
          if (!ag && bg) return 1;
          if (ag && bg) return bg - ag;   /* both earned → most recent first */
          return (RARITY_RANK[rarOf(a)] || 0) - (RARITY_RANK[rarOf(b)] || 0) || pos[a.id] - pos[b.id];
        });
      } else {
        /* rarity, lowest first (common → legendary); catalog position breaks ties so the order stays stable */
        arr.sort(function (a, b) { return (RARITY_RANK[rarOf(a)] || 0) - (RARITY_RANK[rarOf(b)] || 0) || pos[a.id] - pos[b.id]; });
      }
      return arr;
    }

    function render() {
      while (list.firstChild) list.removeChild(list.firstChild);
      var shown = 0;
      sorted().forEach(function (t) {
        var have = !!got[t.id];
        if (state.filter === "unlocked" && !have) return;
        if (state.filter === "locked" && have) return;
        shown++;
        var hidden = t.secret && !have, r = rarOf(t);
        var ico = have ? CUP : (t.secret ? QMARK : LOCK);
        list.appendChild(el("li", { class: "pl-item pl-r-" + r + (have ? " is-got" : " is-locked") + (t.special ? " pl-item--special" : "") },
          el("span", { class: "pl-item__ico" }, svg(ico)),
          el("span", { class: "pl-item__txt" },
            el("span", { class: "pl-item__top" },
              el("strong", { text: hidden ? "Secret trophy" : t.name }),
              el("em", { class: "pl-rarity pl-r-" + r, text: RARITY[r] })),
            el("span", { class: "pl-item__desc", text: hidden ? "Keep poking around." : t.desc }))));
      });
      if (!shown) list.appendChild(el("li", { class: "pl-item pl-item--empty" },
        el("span", { class: "pl-item__txt" }, el("span", { class: "pl-item__desc", text: state.filter === "unlocked" ? "No trophies earned yet — go explore the site!" : "Nothing to show." }))));
    }

    var sortSel = el("select", { class: "pl-sort", "aria-label": "Sort trophies" },
      el("option", { value: "rarity", text: "Rarity" }),
      el("option", { value: "name", text: "Name" }),
      el("option", { value: "earned", text: "Recently earned" }));
    sortSel.addEventListener("change", function () { state.sort = sortSel.value; Site.sfx("tap"); render(); });

    var filterWrap = el("div", { class: "pl-filters", role: "group", "aria-label": "Filter trophies" });
    [["all", "All"], ["unlocked", "Unlocked"], ["locked", "Locked"]].forEach(function (f) {
      var b = el("button", { type: "button", class: "pl-filter", "aria-pressed": f[0] === "all" ? "true" : "false", text: f[1] });
      b.addEventListener("click", function () {
        state.filter = f[0];
        Array.prototype.forEach.call(filterWrap.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
        Site.sfx("tap"); render();
      });
      filterWrap.appendChild(b);
    });
    var controls = el("div", { class: "pl-controls" },
      el("label", { class: "pl-sortwrap" }, el("span", { class: "pl-sortlab", text: "Sort" }), sortSel),
      filterWrap);

    render();
    var body = el("div", {},
      el("p", { class: "pl-list__sum", text: count() + " of " + CORE.length + " earned · saved in this browser only." }),
      controls,
      list,
      el("a", { class: "pl-list__cab btn pl-cabbtn", href: "/trophies/", text: "View the full trophy cabinet →" }),
      el("p", { class: "pl-list__hint", text: "Psst: some words do things if you just type them. One of them is a country where everything is upside down." }));
    var d = Site.modal({ id: "pl-trophies", title: "Trophies", className: "pl-modal", body: body });
    d.addEventListener("close", function () { d.remove(); });
    Site.dialog.open(d);
    setTimeout(function () { award("room"); }, 900);
  }

  Site.ready(function () {
    if (!feat("trophies")) return;
    var tools = Site.tools();
    if (tools) {
      cupCount = el("span", { class: "pl-cup__n", "aria-hidden": "true" });
      cupBtn = el("button", { type: "button", class: "sx-iconbtn pl-cup", style: { order: "40" }, "aria-label": "Trophies", title: "Trophies" }, svg(CUP), cupCount);
      cupBtn.addEventListener("click", function () { Site.sfx("open"); openList(); });
      tools.appendChild(cupBtn); paintCup();
    }
    /* triggers */
    setTimeout(function () { award("hello"); }, 1800);
    var seen = Site.store.get("seen", {}) || {};
    if (Site.page) { seen[Site.page] = 1; Site.store.set("seen", seen); }
    if (seen.hub && seen.anderscraft && seen.anyps && seen.games && seen.resume) setTimeout(function () { award("explorer"); }, 2600);
    if (seen.links && seen.stream && seen.uses && seen.changelog) setTimeout(function () { award("deepcuts"); }, 3000);
    if (seen.arcade) setTimeout(function () { award("arcade"); }, 1500);
    if (seen.support) setTimeout(function () { award("support"); }, 1500);
    if (seen.discord) setTimeout(function () { award("clubhouse"); }, 1500);
    /* a trophy for setting foot on each page in the menu */
    var VKEY = { hub: "v-hub", anderscraft: "v-craft", anyps: "v-anyps", games: "v-games", resume: "v-resume", links: "v-links",
      stream: "v-stream", uses: "v-uses", changelog: "v-changelog", trophies: "v-trophies", account: "v-account", projects: "v-projects",
      explore: "v-explore", dash: "v-dash" };
    /* earned when a visitor has set foot on every page that carries its own visit trophy (homebody) */
    if (Object.keys(VKEY).every(function (k) { return seen[k]; })) setTimeout(function () { award("homebody"); }, 3400);
    Object.keys(VKEY).forEach(function (k) { if (seen[k]) setTimeout(function () { award(VKEY[k]); }, 1600); });
    /* the grand tour: every page in the menu, secret */
    var TOUR = ["hub", "anderscraft", "anyps", "games", "resume", "links", "changelog", "uses", "stream", "support", "discord", "arcade"];
    if (TOUR.every(function (p) { return seen[p]; })) setTimeout(function () { award("grandtour"); }, 3200);
    if (/^\/games\/forum\//.test(location.pathname)) setTimeout(function () { award("forum"); }, 1500);
    try {
      var now = new Date(), day = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate(), days = Site.store.get("days", []) || [];
      if (days.indexOf(day) < 0) { days.push(day); days = days.slice(-400); Site.store.set("days", days); }
      if (days.length >= 3) setTimeout(function () { award("regular"); }, 3400);
      if (days.length >= 7) setTimeout(function () { award("days7"); }, 3450);
      if (days.length >= 14) setTimeout(function () { award("days14"); }, 3500);
      if (days.length >= 30) setTimeout(function () { award("days30"); }, 3500);
      if (days.length >= 50) setTimeout(function () { award("days50"); }, 3500);
      if (days.length >= 100) setTimeout(function () { award("days100"); }, 3500);
      if (days.length >= 200) setTimeout(function () { award("days200"); }, 3500);
      if (now.getDay() === 0 || now.getDay() === 6) setTimeout(function () { award("weekend"); }, 3550);
      /* days in a row: the longest run of consecutive calendar days among the ones on record */
      var nums = days.map(function (sd) { var p = sd.split("-"); return Math.round(new Date(+p[0], +p[1] - 1, +p[2]).getTime() / 86400000); })
        .filter(function (n) { return !isNaN(n); }).sort(function (x, y) { return x - y; });
      var runMax = nums.length ? 1 : 0, runNow = 1;
      for (var di = 1; di < nums.length; di++) {
        if (nums[di] === nums[di - 1] + 1) runNow++; else if (nums[di] !== nums[di - 1]) runNow = 1;
        if (runNow > runMax) runMax = runNow;
      }
      if (runMax >= 3) setTimeout(function () { award("streak"); }, 3600);
      if (runMax >= 7) setTimeout(function () { award("streak7"); }, 3650);
      if (runMax >= 14) setTimeout(function () { award("streak14"); }, 3700);
      if (runMax >= 30) setTimeout(function () { award("streak30"); }, 3750);
      /* time of day */
      var hr = now.getHours();
      if (hr < 4) setTimeout(function () { award("nightowl"); }, 4200);
      if (hr >= 5 && hr < 7) setTimeout(function () { award("earlybird"); }, 4200);
      if (hr >= 11 && hr < 13) setTimeout(function () { award("lunch"); }, 4200);
      if (hr >= 15 && hr < 17) setTimeout(function () { award("teatime"); }, 4200);
      if (hr >= 19 && hr < 22) setTimeout(function () { award("primetime"); }, 4200);
      if (hr === 0) setTimeout(function () { award("witching"); }, 4200);
      /* all four times of day across visits (morning / afternoon / evening / night) */
      var dp = Site.store.get("dayparts", {}) || {}, part = hr < 5 ? "night" : hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening";
      if (!dp[part]) { dp[part] = 1; Site.store.set("dayparts", dp); }
      if (dp.morning && dp.afternoon && dp.evening && dp.night) setTimeout(function () { award("dayparts"); }, 4300);
      /* calendar days (month is 0-based) */
      var mo = now.getMonth(), dt = now.getDate(), dow = now.getDay();
      if (mo === 0 && dt === 1) setTimeout(function () { award("newyear"); }, 4400);
      if (mo === 1 && dt === 14) setTimeout(function () { award("valentines"); }, 4400);
      if (mo === 1 && dt === 29) setTimeout(function () { award("leapday"); }, 4400);
      if (mo === 2 && dt === 14) setTimeout(function () { award("piday"); }, 4400);
      if (mo === 3 && dt === 1) setTimeout(function () { award("aprilfool"); }, 4400);
      if (mo === 4 && dt === 4) setTimeout(function () { award("may4"); }, 4400);
      if (mo === 9 && dt === 31) setTimeout(function () { award("halloween"); }, 4400);
      if (mo === 11 && dt === 25) setTimeout(function () { award("yuletide"); }, 4400);
      /* US Black Friday: the day after the fourth Thursday of November */
      if (mo === 10 && dow === 5 && dt >= 23 && dt <= 29) setTimeout(function () { award("blackfriday"); }, 4400);
      if (dow === 5 && dt === 13) setTimeout(function () { award("friday13"); }, 4400);
      if (dt === 1) setTimeout(function () { award("newmonth"); }, 4450);
    } catch (e) {}
    /* skins: only a choice the visitor makes counts, not the calendar */
    Site.on("pref:season", function (v) {
      if (v && v.detail) v = v.detail;
      var tried = Site.store.get("skinsTried", {}) || {};
      if (v === "classic" || v === "off") { award("classic"); tried.classic = 1; Site.store.set("skinsTried", tried); }
      if (/^(fall|winter|spring|summer)$/.test(v)) { tried[v] = 1; Site.store.set("skinsTried", tried); }
      if (tried.fall && tried.winter && tried.spring && tried.summer) award("seasons");
      if (tried.classic && tried.fall && tried.winter && tried.spring && tried.summer) award("skinmaster");
    });
    var accTried = Site.store.get("accessTried", {}) || {};
    var ACC_T = { textSize: "textbig", contrast: "highcontrast", readFont: "readfont" };   /* each reading aid, on its own */
    ["textSize", "contrast", "readFont"].forEach(function (k) {
      Site.on("pref:" + k, function (v) {
        if (v && v !== "normal") { award("access"); award(ACC_T[k]); accTried[k] = 1; Site.store.set("accessTried", accTried);
          if (accTried.textSize && accTried.contrast && accTried.readFont) award("access-all"); }
      });
    });
    /* reduced motion, on its own */
    Site.on("pref:motion", function (v) { if (v && v.detail != null) v = v.detail; if (v === "off" || v === "reduce" || v === true) award("calmwaters"); });
    /* five wrong codes at the hidden door */
    if (Site.codeMiss && !Site.codeMiss.pl) {
      var say = Site.codeMiss, misses = 0;
      Site.codeMiss = function () { if (++misses >= 5) award("miss5"); return say(); }; Site.codeMiss.pl = true;
    }
    /* the Wiki-Chip Dex pages tell us when the signed-in member really is an Admin */
    Site.on("rop:admin", function (v) { if (v === true || (v && v.detail === true)) award("special"); });
    if (window.ROP_ADMIN === true) setTimeout(function () { award("special"); }, 2000);   /* confirmed before this file loaded */
    /* the Wiki-Chip Dex pages report the signed-in member's rating/review/list/follow tallies */
    function ropStats(v) {
      var s = (v && v.detail) || v;
      if (!s || typeof s !== "object") return;
      var votes = +s.votes || 0, reviews = +s.reviews || 0, lists = +s.lists || 0, following = +s.following || 0;
      /* each ladder: award every tier the tally has reached */
      [[1, "rop-rate1"], [5, "rop-rate5"], [10, "rop-rate10"], [25, "rop-rate25"], [50, "rop-rate50"], [75, "rop-rate75"],
       [100, "rop-rate100"], [150, "rop-rate150"], [250, "rop-rate250"], [300, "rop-rate300"], [500, "rop-rate500"],
       [750, "rop-rate750"], [1000, "rop-rate1000"], [2000, "rop-rate2000"]].forEach(function (p) { if (votes >= p[0]) award(p[1]); });
      [[1, "rop-review"], [5, "rop-review5"], [10, "rop-review10"], [15, "rop-review15"], [25, "rop-review25"],
       [50, "rop-review50"], [75, "rop-review75"], [100, "rop-review100"]].forEach(function (p) { if (reviews >= p[0]) award(p[1]); });
      [[1, "rop-list"], [3, "rop-list3"], [5, "rop-list5"], [10, "rop-list10"], [25, "rop-list25"], [50, "rop-list50"]]
        .forEach(function (p) { if (lists >= p[0]) award(p[1]); });
      [[1, "rop-follow"], [5, "rop-follow5"], [10, "rop-follow10"], [25, "rop-follow25"], [50, "rop-follow50"], [100, "rop-follow100"]]
        .forEach(function (p) { if (following >= p[0]) award(p[1]); });
    }
    Site.on("rop:stats", ropStats);
    if (window.ROP_STATS) setTimeout(function () { ropStats(window.ROP_STATS); }, 2000);
    /* the account settings centre (assets/account-center.js) emits the signed-in member's account + profile */
    function acctCheck(v) {
      var S = (v && v.detail) || v; if (!S || typeof S !== "object") return;
      var a = S.account || {}, p = S.profile || {};
      award("acct");
      if (a.verified) award("acct-verified");
      if (a.has_discord) award("acct-discord");
      if (a.has_dma) award("acct-dma");
      if (a.supporter) award("acct-supporter");
      if (a.handle) award("acct-handle");
      if (a.flair && a.flair !== "none") award("acct-flair");
      if (p.avatar) award("acct-avatar");
      if (p.motto) award("acct-motto");
      if (p.status_text || p.status_emoji) award("acct-status");
      if (p.bio) award("acct-bio");
      if (p.pronouns) award("acct-pronouns");
      if (p.now_playing) award("acct-now");
      if (p.accent) award("acct-accent");
      /* every part of the profile filled in */
      if (p.avatar && p.motto && p.bio && (p.status_text || p.status_emoji) && p.pronouns && p.accent && p.now_playing) award("acct-complete");
    }
    Site.on("account:settings", acctCheck);
    if (window.ACCT_SETTINGS) setTimeout(function () { acctCheck(window.ACCT_SETTINGS); }, 2000);
    if (Site.page === "404") setTimeout(function () { award("lost"); }, 1200);
    if (Site.page === "vault" || Site.page === "locker") setTimeout(function () { award("key"); }, 1200);
    if (seen.vault && seen.locker) setTimeout(function () { award("twodoors"); }, 1300);
    Site.on("pref:soundscape", function (v) { if (v === true || (v && v.detail === true)) award("dj"); });
    Site.on("konami", function () { award("konami"); });
    Site.on("dialog:open", function (d) {
      var n = d && d.id ? d : d && d.detail; var id = n && n.id;
      if (id === "hb-code") award("door"); else if (id === "hg-box") award("hire"); else if (id === "ax-keys") award("shortcuts");
    });
    Site.on("resume:card", function () { award("card"); });   /* opened a project dropdown on the résumé */
    Site.on("ui:settings-shown", function () { award("settings"); });   /* settings now live inside the radial menu */
    /* collection milestones + combos — re-checked on every award. */
    var MILES = [[5, "collect5"], [10, "collect10"], [15, "collect15"], [20, "collect20"], [25, "collect25"], [30, "collect30"], [35, "collect35"], [40, "collect40"]
      , [45, "collect45"], [50, "collect50"], [55, "collect55"], [60, "collect60"], [65, "collect65"], [70, "collect70"], [75, "collect75"], [85, "collect85"]
      , [90, "collect90"], [95, "collect95"], [100, "collect100"], [110, "collect110"], [125, "collect125"], [135, "collect135"], [150, "collect150"], [160, "collect160"]
      , [175, "collect175"], [190, "collect190"], [200, "collect200"], [210, "collect210"], [225, "collect225"], [240, "collect240"]];
    /* combos: award the first trophy once every required trophy is held (re-checked on every award) */
    var COMBOS = [
      ["comfort", ["dj", "calmwaters"]],
      ["comfyreader", ["calmwaters", "readfont"]],
      ["accessible", ["calmwaters", "access-all"]],
      ["settler", ["collect50", "days30"]],
      ["regular-critic", ["rop-rate50", "rop-review10"]],
      ["decorator", ["theme", "classic"]],
      ["faithful", ["support", "days7"]],
      ["cardcarrier", ["clubhouse", "seeyou"]],
      ["tourguide", ["v-explore", "deepcuts"]],
      ["prankster", ["freefall", "barrel", "dancefever", "redpill", "snowday"]],
      ["secretagent", ["australia", "dancefever", "redpill", "snowday", "barrel", "freefall", "tubelife", "aesthetic"]],
      ["soundvision", ["dj", "tubelife", "aesthetic"]],
      ["chameleon", ["theme", "skinmaster"]],
      ["insomniac", ["nightowl", "earlybird", "witching"]],
      ["truecritic", ["rop-rate100", "rop-review25", "rop-list5"]],
      ["ratingmachine", ["rop-rate500", "rop-review50"]],
      ["peopleperson", ["rop-follow10", "rop-review", "rop-list"]],
      ["socialite", ["rop-follow25", "forum", "seeyou"]],
      ["longhauler", ["days50", "streak14"]],
      ["weekendregular", ["weekend", "days7"]],
      ["grinder", ["days100", "collect100"]],
      ["mapmaker", ["explorer", "grandtour"]],
      ["welcomewagon", ["acct", "acct-avatar", "acct-motto"]],
      ["supporterplus", ["acct-supporter", "acct-verified"]],
      ["themefan", ["themehop10", "skinmaster"]],
      ["dawndusk", ["earlybird", "primetime"]],
      ["wordofmouth", ["share", "voter", "seeyou"]],
      ["bookworm", ["rop-rate100", "rop-list5", "rop-review10"]],
      ["earlyriser", ["earlybird", "lunch", "teatime"]],
      ["deepdiver", ["v-dash", "tourguide", "twodoors"]],
      ["patronsaint", ["acct-supporter", "support"]],
      ["firstweek", ["regular", "collect10"]],
      ["nightshifter", ["nightowl", "streak7"]],
      ["completokraut", ["collect200", "days200"]],
      ["jackofall", ["rop-rate1", "rop-review", "rop-list", "rop-follow", "forum"]],
      ["showoff", ["acct-complete", "acct-handle", "acct-flair"]],
      ["globetrotter", ["grandtour", "deepcuts"]],
      ["acct-early", ["acct-dma", "acct-handle", "acct-verified"]],
      ["acct-decorated", ["acct-flair", "acct-supporter"]],
      ["acct-social", ["acct", "acct-discord", "acct-handle"]],
      ["allnighter", ["nightowl", "witching", "streak"]],
      ["tastemaker", ["rop-rate250", "rop-follow25"]],
      ["veteran", ["days50", "collect50"]],
      ["devotee", ["days100", "collect150"]],
      ["penpal", ["rop-review50", "rop-follow25"]],
      ["homesteader", ["v-hub", "v-craft", "v-anyps"]],
      ["curious", ["menu", "settings", "shortcuts", "room"]],
      ["the-full-dex", ["rop-rate1", "rop-review", "rop-list", "rop-follow", "forum", "acct-handle"]]
    ];
    var RSET = ["common", "uncommon", "rare", "epic", "legendary"];
    function metacheck() {
      var n = count();
      if (n >= Math.ceil(CORE.length / 2)) award("halfway");
      for (var i = 0; i < MILES.length; i++) if (n >= MILES[i][0]) award(MILES[i][1]);
      if (got.nightowl && got.earlybird) award("nightandday");
      if (got.share && got.seeyou) award("shareall");
      for (var c = 0; c < COMBOS.length; c++) {
        var req = COMBOS[c][1], ok = true;
        for (var r = 0; r < req.length; r++) if (!got[req[r]]) { ok = false; break; }
        if (ok) award(COMBOS[c][0]);
      }
      var secretN = 0, rar = {};
      for (var si = 0; si < CORE.length; si++) { var ct = CORE[si]; if (got[ct.id]) { if (ct.secret) secretN++; rar[rarOf(ct)] = 1; } }
      if (secretN >= 1) award("firstsecret");
      if (secretN >= 20) award("halfsecret");
      if (RSET.every(function (x) { return rar[x]; })) award("allrarities");
    }
    Site.on("trophy:earned", metacheck);
    setTimeout(metacheck, 2000);
    var themeFlips = Site.store.get("themeFlips", 0) || 0;
    var shareCount = Site.store.get("shareCount", 0) || 0;
    doc.addEventListener("click", function (e) {
      var t = e.target; if (!t || !t.closest) return;
      if (t.closest(".ch-theme")) { award("theme"); themeFlips++; Site.store.set("themeFlips", themeFlips); if (themeFlips >= 5) award("themehop"); if (themeFlips >= 10) award("themehop10"); if (themeFlips >= 25) award("themehop25"); }
      else if (t.closest(".ch-share")) { award("share"); shareCount++; Site.store.set("shareCount", shareCount); if (shareCount >= 3) award("share3"); }
      else if (t.closest(".ch-menu")) award("menu");
      else if (t.closest(".lk2-go,.lk2-shotlink")) award("linkout");
      else if (t.closest(".lk2-vote")) award("voter");
      else if (t.closest("a[href*='discord.gg']")) award("seeyou");
    });
    /* opened project dropdowns on the résumé — three different opens earns Project Scout */
    var cardOpens = Site.store.get("cardOpens", 0) || 0;
    Site.on("resume:card", function () { cardOpens++; Site.store.set("cardOpens", cardOpens); if (cardOpens >= 3) award("projectfan"); });
    var bottomDone = false;
    window.addEventListener("scroll", function () {
      if (bottomDone) return;
      var max = root.scrollHeight - window.innerHeight;
      if (max > 600 && (window.pageYOffset || root.scrollTop) >= max - 4) {
        bottomDone = true; award("bottom");
        /* bottom of ten different pages earns Marathon Scroller */
        try { var bp = Site.store.get("bottomPages", {}) || {}; if (Site.page && !bp[Site.page]) { bp[Site.page] = 1; Site.store.set("bottomPages", bp); } if (Object.keys(bp).length >= 10) award("bottom10"); } catch (e) {}
      }
    }, { passive: true });
  }, "trophies");

  /* ====================================================================================================
   * 2. Secret codes
   * ==================================================================================================== */
  var FALLERS = ".avenue,.hb-rate,.hb-hire,.hb-ticker,.hb-now,.hb-hint,.rz-stat,.rz-card,.rz-job,.rz-skillset,.rz-cred__col,.rz-contact,.rz-btn," +
    ".game,.panel,.feat li,.social,.sx-chip,.sx-iconbtn,.brand,h1,h2,h3,.lead,.eyebrow,.rz-pitch,.rz-role,footer p,form,.discord-btn,img,video";
  var active = {}, found = Site.store.get("codes", {}) || {};

  function inView() {
    var out = [], all = doc.querySelectorAll(FALLERS), vh = window.innerHeight, vw = window.innerWidth;
    for (var i = 0; i < all.length && out.length < 70; i++) {
      var n = all[i];
      if (n.closest("dialog,.pl-trophy,.ix-ring")) continue;
      var r = n.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      /* skip anything that contains another faller, so the pieces that fall are the leaves */
      if (n.querySelector(FALLERS) && !/^(H1|H2|H3)$/.test(n.tagName) && !n.matches(".avenue,.rz-card,.rz-job,.rz-stat,.game")) continue;
      if (n.parentElement && n.parentElement.closest(".avenue,.rz-card,.rz-job,.rz-stat,.game,.hb-rate,.rz-contact,.rz-skillset,.rz-cred__col")) continue;
      out.push({ n: n, r: r });
    }
    return out;
  }
  /* drop: every visible block falls to the bottom of the screen and piles up. flipped = the page is upside down,
     so "down on screen" is "up" in the page's own coordinates. Returns a function that puts everything back. */
  function drop(flipped) {
    var items = inView(), vh = window.innerHeight;
    items.forEach(function (it, i) {
      var n = it.n, r = it.r;
      it.t = n.style.transform; it.tr = n.style.transition; it.z = n.style.zIndex; it.pos = n.style.position;
      var dist = Math.max(0, vh - r.bottom - 6 - Math.random() * 26), rot = (Math.random() * 50 - 25);
      n.style.transition = "transform " + (0.75 + Math.random() * 0.5).toFixed(2) + "s cubic-bezier(.5,0,.9,.45) " + (i * 0.018 + Math.random() * 0.25).toFixed(2) + "s";
      if (getComputedStyle(n).position === "static") n.style.position = "relative";
      n.style.zIndex = "5";
      n.style.transform = "translate(" + (Math.random() * 40 - 20).toFixed(0) + "px," + ((flipped ? -1 : 1) * dist).toFixed(0) + "px) rotate(" + rot.toFixed(1) + "deg)";
    });
    return function restore() {
      items.forEach(function (it) {
        var n = it.n;
        n.style.transition = "transform .7s cubic-bezier(.2,.8,.2,1)";
        n.style.transform = it.t || "";
        setTimeout(function () { n.style.transition = it.tr || ""; n.style.zIndex = it.z || ""; n.style.position = it.pos || ""; }, 760);
      });
    };
  }
  function pivot() { var y = (window.pageYOffset || root.scrollTop || 0) + window.innerHeight / 2; doc.body.style.transformOrigin = "50% " + y + "px"; }
  function timed(name, ms, stop) {
    var t = setTimeout(function () { end(name); }, ms);
    active[name] = function () { clearTimeout(t); stop(); };
  }
  function end(name) { var f = active[name]; if (f) { delete active[name]; f(); } }
  function endAll() { Object.keys(active).forEach(end); }

  var CODES = {
    australia: function () {
      pivot(); root.classList.add("pl-flip");
      Site.toast("G'day. Type it again or press Esc to come back up.", { type: "ok", ms: 5200 });
      var restore = null, t1 = setTimeout(function () { restore = drop(true); }, 1250);
      timed("australia", 14000, function () {
        clearTimeout(t1); if (restore) restore();
        setTimeout(function () { root.classList.remove("pl-flip"); setTimeout(function () { doc.body.style.transformOrigin = ""; }, 1300); }, restore ? 500 : 0);
      });
      award("australia");
    },
    gravity: function () {
      Site.toast("Gravity: on.", { type: "info", ms: 2600 });
      var restore = drop(false);
      timed("gravity", 7000, restore);
    },
    moon: function () {
      Site.toast("One sixth of the gravity.", { type: "info", ms: 2600 });
      var items = inView();
      items.forEach(function (it) { it.n.style.setProperty("--pl-d", (Math.random() * -4).toFixed(2) + "s"); it.n.style.setProperty("--pl-a", (8 + Math.random() * 16).toFixed(0) + "px"); it.n.classList.add("pl-float"); });
      timed("moon", 10000, function () { items.forEach(function (it) { it.n.classList.remove("pl-float"); it.n.style.removeProperty("--pl-d"); it.n.style.removeProperty("--pl-a"); }); });
    },
    barrelroll: function () {
      pivot(); root.classList.add("pl-roll");
      timed("barrelroll", 1500, function () { root.classList.remove("pl-roll"); doc.body.style.transformOrigin = ""; });
    },
    crt: function () {
      var on = root.classList.toggle("pl-crt");
      Site.store.set("crt", on);
      Site.toast(on ? "CRT mode on. Type crt again to switch it off." : "CRT mode off.", { type: "info", ms: 3000 });
    },
    disco: function () {
      root.classList.add("pl-disco");
      Site.toast("Disco.", { type: "ok", ms: 2200 });
      timed("disco", 9000, function () { root.classList.remove("pl-disco"); });
    },
    matrix: function () {
      var cv = el("canvas", { class: "pl-matrix", "aria-hidden": "true" }), ctx = cv.getContext("2d"), raf = 0, cols = [], last = 0;
      doc.body.appendChild(cv);
      function size() { cv.width = window.innerWidth; cv.height = window.innerHeight; cols = []; for (var i = 0; i < Math.ceil(cv.width / 16); i++) cols.push(Math.random() * -40); }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        if (t - last < 55) return; last = t;
        ctx.fillStyle = "rgba(0,0,0,.09)"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.font = "15px monospace";
        for (var i = 0; i < cols.length; i++) {
          var ch = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)), y = cols[i] * 16;
          ctx.fillStyle = Math.random() < 0.06 ? "#d9ffe6" : "#35e07a"; ctx.fillText(ch, i * 16, y);
          cols[i] = y > cv.height && Math.random() > 0.975 ? 0 : cols[i] + 1;
        }
      }
      size(); raf = requestAnimationFrame(frame);
      requestAnimationFrame(function () { cv.classList.add("is-in"); });
      timed("matrix", 9000, function () { cv.classList.remove("is-in"); setTimeout(function () { cancelAnimationFrame(raf); cv.remove(); }, 600); });
    },
    snow: function () {
      var cv = el("canvas", { class: "pl-snow", "aria-hidden": "true" }), ctx = cv.getContext("2d"), raf = 0, flakes = [], last = 0;
      doc.body.appendChild(cv);
      function size() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
      function seed() { flakes = []; var n = Math.min(260, Math.round(cv.width / 9)); for (var i = 0; i < n; i++) flakes.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: 1 + Math.random() * 2.6, s: 16 + Math.random() * 40, d: Math.random() * 6.28, sw: 8 + Math.random() * 24 }); }
      function onr() { size(); seed(); }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(40, t - last) : 16.7; last = t; var s = dt / 1000;
        ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = "#ffffff";
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i]; f.d += s; f.y += f.s * s; f.x += Math.sin(f.d) * f.sw * s;
          if (f.y > cv.height + 4) { f.y = -4; f.x = Math.random() * cv.width; }
          ctx.globalAlpha = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(f.d)); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      size(); seed(); window.addEventListener("resize", onr); raf = requestAnimationFrame(frame);
      requestAnimationFrame(function () { cv.classList.add("is-in"); });
      Site.toast("Let it snow. Type snow again or press Esc to clear it.", { type: "info", ms: 4200 });
      timed("snow", 14000, function () { cv.classList.remove("is-in"); window.removeEventListener("resize", onr); setTimeout(function () { cancelAnimationFrame(raf); cv.remove(); }, 600); });
    },
    vaporwave: function () {
      root.classList.add("pl-vapor");
      Site.toast("ｖａｐｏｒｗａｖｅ", { type: "ok", ms: 3200 });
      timed("vaporwave", 13000, function () { root.classList.remove("pl-vapor"); });
    }
  };
  var STILL_OK = { crt: 1 };                          /* effects that are fine with reduced motion */
  var NAV = { "404game": "/404.html" };               /* cheat codes that just take you somewhere (digits allowed) */

  /* each secret word has its own trophy (australia awards its own inside CODES.australia) */
  var CODE_TROPHY = { disco: "dancefever", matrix: "redpill", snow: "snowday", barrelroll: "barrel",
    moon: "freefall", gravity: "freefall", crt: "tubelife", vaporwave: "aesthetic" };
  function run(word) {
    if (active[word]) { end(word); return; }
    if (Site.reducedMotion && !STILL_OK[word]) { Site.toast("That one needs motion. Turn off 'Reduce Motion' in settings to see it.", { type: "info", ms: 4200 }); return; }
    endAll();
    CODES[word]();
    found[word] = 1; Site.store.set("codes", found);
    if (CODE_TROPHY[word]) award(CODE_TROPHY[word]);
    if (Object.keys(found).length >= 3) award("codes");
    if (Object.keys(found).length >= 5) award("codes5");
    if (found.crt && found.matrix && found.vaporwave) award("screensaver");
    if (found.australia && found.barrelroll) award("topsyturvy");
    if (Object.keys(CODES).every(function (w) { return found[w]; })) award("fulldeck");
  }
  Site.secret = function (word) {
    var raw = String(word || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (NAV[raw]) { location.href = NAV[raw]; return true; }
    var w = raw.replace(/[0-9]/g, "");
    if (CODES[w]) { run(w); return true; }
    return false;
  };

  Site.ready(function () {
    if (!feat("secretCodes")) return;
    if (Site.store.get("crt", false) === true) root.classList.add("pl-crt");
    var buf = "", names = Object.keys(CODES), navs = Object.keys(NAV);
    doc.addEventListener("keydown", function (e) {
      if (document.documentElement.hasAttribute("data-arcade-input")) return;   /* a playable game owns input (WASD/arrows/Esc/P) */
      if (e.key === "Escape") { endAll(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var c = e.key.toLowerCase(); if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9"))) return;
      buf = (buf + c).slice(-16);
      for (var j = 0; j < navs.length; j++) if (buf.slice(-navs[j].length) === navs[j]) { buf = ""; location.href = NAV[navs[j]]; return; }
      for (var i = 0; i < names.length; i++) if (buf.slice(-names[i].length) === names[i]) { buf = ""; run(names[i]); break; }
    });
  }, "secret codes");

  /* ====================================================================================================
   * 3. Controller combo: Y, B, A, X  (triangle, circle, cross, square)
   * ==================================================================================================== */
  Site.ready(function () {
    if (!feat("padCombo") || !Site.gamepad) return;
    var want = ["y", "b", "a", "x"], at = 0, last = 0;
    Site.gamepad.on(function (btn) {
      var now = Date.now(); if (now - last > 2500) at = 0; last = now;
      if (btn === want[at]) at++; else at = btn === want[0] ? 1 : 0;
      if (at === want.length) {
        at = 0; award("combo");
        Site.toast("Combo! Triangle, circle, cross, square.", { type: "ok", ms: 3200 });
        if (!Site.reducedMotion) { end("barrelroll"); CODES.barrelroll(); }
      }
    });
  }, "pad combo");

  /* ====================================================================================================
   * 4. Boot intro (hub, once per session). index.html adds .pl-preboot before first paint so nothing flashes.
   * ==================================================================================================== */
  Site.ready(function () {
    var pre = root.classList.contains("pl-preboot");
    function clear() { root.classList.remove("pl-preboot"); }
    if (Site.page !== "hub" || !feat("intro") || Site.reducedMotion || !doc.body) { clear(); return; }
    var done = false; try { done = sessionStorage.getItem("pl.boot") === "1"; } catch (e) {}
    if (done || !pre) { clear(); return; }
    try { sessionStorage.setItem("pl.boot", "1"); } catch (e) {}
    var boot = el("div", { class: "pl-boot", role: "presentation" },
      el("div", { class: "pl-boot__in" },
        el("span", { class: "pl-boot__ring" }, el("img", { src: "/assets/icons/icon-192.png", alt: "", width: "96", height: "96" })),
        el("strong", { class: "pl-boot__name", text: "ANDERS" }),
        el("span", { class: "pl-boot__bar" }, el("i")),
        el("small", { class: "pl-boot__skip", text: "Press any key to skip" })));
    doc.body.appendChild(boot);
    clear();
    var gone = false;
    function finish() {
      if (gone) return; gone = true;
      boot.classList.add("is-out");
      window.removeEventListener("keydown", finish, true); boot.removeEventListener("pointerdown", finish);
      setTimeout(function () { boot.remove(); }, 520);
    }
    window.addEventListener("keydown", finish, true); boot.addEventListener("pointerdown", finish);
    requestAnimationFrame(function () { boot.classList.add("is-on"); });
    setTimeout(finish, 2500);
  }, "boot intro");
})();
