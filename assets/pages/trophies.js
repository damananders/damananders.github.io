/* Trophy Cabinet (/trophies/): a full-page view of every trophy, earned or not.
 * Reads the same per-browser store play.js writes (Site.store "trophies" = { id: timestamp }).
 * The CATALOG below MIRRORS the TROPHIES list in assets/play.js — keep the two in sync when trophies change.
 * (Kept separate on purpose so this page needs no sitewide interact.js cache bump to render.)
 */
(function () {
  "use strict";
  if (!window.Site) return;
  var S = Site;

  /* MIRRORS assets/play.js TROPHIES (same order + rarity) — keep the two in sync when trophies change. */
  var CATALOG = [
    { id: "hello", name: "Player One", desc: "Showed up. That's the first step.", rarity: "common" },
    { id: "explorer", name: "Cartographer", desc: "Visited the hub, AndersCraft, AnyPS, the ratings and the résumé.", rarity: "uncommon" },
    { id: "theme", name: "Night Shift", desc: "Flipped between the dark and light themes.", rarity: "common" },
    { id: "settings", name: "Tinkerer", desc: "Opened the settings panel.", rarity: "common" },
    { id: "bottom", name: "Rock Bottom", desc: "Scrolled a page all the way down.", rarity: "common" },
    { id: "share", name: "Word of Mouth", desc: "Used the share button.", rarity: "common" },
    { id: "dj", name: "Sea Breeze", desc: "Turned on the soundscape.", rarity: "common" },
    { id: "hire", name: "Headhunter", desc: "Opened the 'work with me' box.", rarity: "common" },
    { id: "card", name: "Due Diligence", desc: "Opened a project card on the résumé.", rarity: "common" },
    { id: "lost", name: "Off the Map", desc: "Found the 404 page.", secret: true, rarity: "uncommon" },
    { id: "door", name: "Knock Knock", desc: "Found the hidden door.", secret: true, rarity: "uncommon" },
    { id: "key", name: "Keymaster", desc: "Got through the hidden door.", secret: true, rarity: "rare" },
    { id: "konami", name: "Old School", desc: "Entered a very famous cheat code.", secret: true, rarity: "rare" },
    { id: "australia", name: "Down Under", desc: "Turned the whole site upside down.", secret: true, rarity: "rare" },
    { id: "codes", name: "Codebreaker", desc: "Discovered three different secret words.", secret: true, rarity: "rare" },
    { id: "combo", name: "Button Masher", desc: "Pulled off the controller combo.", secret: true, rarity: "rare" },
    { id: "sailor", name: "Old Salt", desc: "Scored 300 or more in the boat game on the lost page.", secret: true, rarity: "rare" },
    { id: "boat1k", name: "Steady Hand", desc: "Scored 1,000 or more in the boat game on the lost page.", secret: true, rarity: "epic" },
    { id: "boat5k", name: "Master Mariner", desc: "Scored 5,000 or more in the boat game on the lost page.", secret: true, rarity: "legendary" },
    { id: "rs-easy", name: "First Stamp", desc: "Beat Easy in the Review Score game.", secret: true, rarity: "uncommon" },
    { id: "rs-medium", name: "Getting Critical", desc: "Beat Medium in the Review Score game.", secret: true, rarity: "rare" },
    { id: "rs-hard", name: "Tough Critic", desc: "Beat Hard in the Review Score game.", secret: true, rarity: "epic" },
    { id: "rs-harder", name: "Harsh Reviewer", desc: "Beat Harder ;) in the Review Score game.", secret: true, rarity: "epic" },
    { id: "rs-harderer", name: "Ruthless", desc: "Beat the hidden Harder…er in the Review Score game.", secret: true, rarity: "legendary" },
    { id: "menu", name: "Navigator", desc: "Opened the page menu.", rarity: "common" },
    { id: "deepcuts", name: "Deep Cuts", desc: "Visited Links I Like, the stream page, Uses and What's New.", rarity: "uncommon" },
    { id: "forum", name: "Town Square", desc: "Dropped by the Wiki-Chip Dex forums.", rarity: "common" },
    { id: "linkout", name: "Link Hopper", desc: "Visited a site from Links I Like.", rarity: "common" },
    { id: "voter", name: "Have Your Say", desc: "Voted on a site in Links I Like.", rarity: "common" },
    { id: "rop-rate1", name: "First Opinion", desc: "Rated a game on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-rate10", name: "Warming Up", desc: "Rated 10 games on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-rate25", name: "Critic in Training", desc: "Rated 25 games on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-rate50", name: "Regular Reviewer", desc: "Rated 50 games on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-rate100", name: "Seasoned Critic", desc: "Rated 100 games on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-rate250", name: "Veteran Critic", desc: "Rated 250 games on Wiki-Chip Dex.", rarity: "epic" },
    { id: "rop-rate500", name: "Encyclopedist", desc: "Rated 500 games on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-rate1000", name: "Librarian", desc: "Rated 1,000 games on Wiki-Chip Dex.", secret: true, rarity: "legendary" },
    { id: "rop-review", name: "Wordsmith", desc: "Wrote a review on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-review10", name: "Prolific Critic", desc: "Wrote 10 reviews on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-review25", name: "Essayist", desc: "Wrote 25 reviews on Wiki-Chip Dex.", rarity: "rare" },
    { id: "rop-list", name: "Curator", desc: "Made a game list on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-list5", name: "List Maker", desc: "Made 5 game lists on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "rop-follow", name: "Following the Crowd", desc: "Followed a member on Wiki-Chip Dex.", rarity: "common" },
    { id: "rop-follow10", name: "Well Connected", desc: "Followed 10 members on Wiki-Chip Dex.", rarity: "uncommon" },
    { id: "classic", name: "Lighthouse Keeper", desc: "Switched the site to its Classic skin.", rarity: "common" },
    { id: "seasons", name: "Four Seasons", desc: "Tried the fall, winter, spring and summer skins.", rarity: "uncommon" },
    { id: "skinmaster", name: "Dressed to Impress", desc: "Tried the Classic skin and all four seasonal skins.", rarity: "uncommon" },
    { id: "access", name: "Easy Reader", desc: "Tried an accessibility option.", rarity: "common" },
    { id: "access-all", name: "Fully Loaded", desc: "Tried the text-size, contrast and reading-font options.", rarity: "uncommon" },
    { id: "shortcuts", name: "Shortcut Artist", desc: "Opened the keyboard shortcut map.", rarity: "common" },
    { id: "room", name: "Window Shopper", desc: "Looked through the trophy list.", rarity: "common" },
    { id: "regular", name: "Regular", desc: "Came back on three different days.", rarity: "uncommon" },
    { id: "days7", name: "One Week In", desc: "Came back on seven different days.", rarity: "uncommon" },
    { id: "days14", name: "Fortnight Fan", desc: "Came back on fourteen different days.", secret: true, rarity: "rare" },
    { id: "weekend", name: "Weekend Warrior", desc: "Visited on a weekend.", rarity: "common" },
    { id: "streak", name: "On a Roll", desc: "Came back three days in a row.", secret: true, rarity: "rare" },
    { id: "streak7", name: "Week-Long Streak", desc: "Came back seven days in a row.", secret: true, rarity: "epic" },
    { id: "miss5", name: "Unfivetunately", desc: "Typed five wrong codes into the hidden door.", secret: true, rarity: "rare" },
    { id: "nightowl", name: "Night Owl", desc: "Visited between midnight and four in the morning.", secret: true, rarity: "rare" },
    { id: "earlybird", name: "Early Bird", desc: "Visited between five and seven in the morning.", secret: true, rarity: "rare" },
    { id: "nightandday", name: "Round the Clock", desc: "Dropped in both late at night and early in the morning.", secret: true, rarity: "rare" },
    { id: "warcraft", name: "Realm Keeper", desc: "Found the AndersCraft client stashed in the Locker.", secret: true, rarity: "rare" },
    { id: "offsite", name: "Off-Site Backup", desc: "Grabbed one of the backups from the Locker.", secret: true, rarity: "rare" },
    { id: "twodoors", name: "Lockpick", desc: "Got through both hidden doors — the Vault and the Locker.", secret: true, rarity: "rare" },
    { id: "v-hub", name: "Home Base", desc: "Landed on the hub.", rarity: "common" },
    { id: "v-craft", name: "Realm Visitor", desc: "Visited the AndersCraft page.", rarity: "common" },
    { id: "v-anyps", name: "Console Cowboy", desc: "Visited the AnyPS page.", rarity: "common" },
    { id: "v-games", name: "Browsing the Shelves", desc: "Visited Wiki-Chip Dex.", rarity: "common" },
    { id: "v-resume", name: "The Pitch", desc: "Opened the résumé.", rarity: "common" },
    { id: "v-links", name: "Link Library", desc: "Visited Links I Like.", rarity: "common" },
    { id: "v-stream", name: "Now Streaming", desc: "Visited the stream page.", rarity: "common" },
    { id: "v-uses", name: "Toolbox Peek", desc: "Visited the Uses page.", rarity: "common" },
    { id: "v-changelog", name: "Patch Reader", desc: "Visited What's New.", rarity: "common" },
    { id: "v-trophies", name: "Trophy Room", desc: "Visited the trophy cabinet.", rarity: "common" },
    { id: "v-account", name: "Account Page", desc: "Visited the account page.", rarity: "common" },
    { id: "v-projects", name: "What's Cooking", desc: "Visited the What I'm Working On page.", rarity: "common" },
    { id: "arcade", name: "Insert Coin", desc: "Dropped by the arcade.", rarity: "common" },
    { id: "support", name: "Keeping the Lights On", desc: "Stopped by the support page.", rarity: "common" },
    { id: "clubhouse", name: "Found the Clubhouse", desc: "Visited the Discord page.", rarity: "common" },
    { id: "seeyou", name: "See You There", desc: "Followed the invite to the Discord server.", rarity: "uncommon" },
    { id: "shareall", name: "Spread the Word", desc: "Used the share button and followed the Discord invite.", rarity: "uncommon" },
    { id: "acct", name: "Got an Account", desc: "Signed in with a DaManAnders account.", rarity: "common" },
    { id: "acct-discord", name: "Linked Up", desc: "Linked your Discord to your account.", rarity: "common" },
    { id: "acct-dma", name: "Native Account", desc: "Set up a native DaManAnders account.", rarity: "common" },
    { id: "acct-handle", name: "Name Claimed", desc: "Claimed your @handle.", rarity: "uncommon" },
    { id: "acct-verified", name: "Verified", desc: "Confirmed your account.", rarity: "uncommon" },
    { id: "acct-flair", name: "Flaired Up", desc: "Earned a profile flair.", rarity: "uncommon" },
    { id: "acct-supporter", name: "Supporter", desc: "Became a Supporter.", rarity: "rare" },
    { id: "acct-avatar", name: "New Look", desc: "Set a profile avatar.", rarity: "uncommon" },
    { id: "acct-motto", name: "Words to Live By", desc: "Set a profile motto.", rarity: "common" },
    { id: "acct-status", name: "Status Update", desc: "Set a profile status.", rarity: "common" },
    { id: "acct-bio", name: "About Me", desc: "Wrote a profile bio.", rarity: "common" },
    { id: "acct-pronouns", name: "Introductions", desc: "Added your pronouns.", rarity: "common" },
    { id: "acct-now", name: "Now Playing", desc: "Set what you're now playing.", rarity: "common" },
    { id: "acct-accent", name: "True Colors", desc: "Picked a profile accent color.", rarity: "common" },
    { id: "dancefever", name: "Dance Fever", desc: "Started the disco.", secret: true, rarity: "rare" },
    { id: "redpill", name: "Red Pill", desc: "Followed the white rabbit into the matrix.", secret: true, rarity: "rare" },
    { id: "snowday", name: "Snow Day", desc: "Made it snow.", secret: true, rarity: "rare" },
    { id: "barrel", name: "Do a Barrel Roll", desc: "Did a barrel roll.", secret: true, rarity: "rare" },
    { id: "freefall", name: "Free Fall", desc: "Messed with the site's gravity.", secret: true, rarity: "rare" },
    { id: "tubelife", name: "Tube Life", desc: "Switched on CRT mode.", secret: true, rarity: "rare" },
    { id: "aesthetic", name: "Aesthetic", desc: "Went full vaporwave.", secret: true, rarity: "rare" },
    { id: "screensaver", name: "Screen Saver", desc: "Tried CRT mode, the matrix and vaporwave.", secret: true, rarity: "rare" },
    { id: "topsyturvy", name: "Topsy Turvy", desc: "Flipped the site with both Australia and a barrel roll.", secret: true, rarity: "uncommon" },
    { id: "codes5", name: "Word Wizard", desc: "Discovered five different secret words.", secret: true, rarity: "rare" },
    { id: "fulldeck", name: "Full Deck", desc: "Discovered every secret word on the site.", secret: true, rarity: "epic" },
    { id: "themehop", name: "Can't Decide", desc: "Flipped the theme five times.", secret: true, rarity: "uncommon" },
    { id: "themehop10", name: "Truly Indecisive", desc: "Flipped the theme ten times.", secret: true, rarity: "rare" },
    { id: "pj-vote", name: "I Approve", desc: "Upvoted a project on the What I'm Working On page.", rarity: "common" },
    { id: "pj-vote3", name: "Hype Man", desc: "Upvoted three different projects.", rarity: "uncommon" },
    { id: "pj-comment", name: "Two Cents", desc: "Commented on a project.", rarity: "common" },
    { id: "pj-reply", name: "Good Point", desc: "Replied to a comment on a project.", rarity: "common" },
    { id: "halfway", name: "Halfway There", desc: "Earned half of all the trophies.", rarity: "rare" },
    { id: "collect5", name: "Getting Started", desc: "Earned five trophies.", rarity: "common" },
    { id: "collect10", name: "Shelf Space", desc: "Earned ten trophies.", rarity: "common" },
    { id: "collect20", name: "Collector", desc: "Earned twenty trophies.", rarity: "uncommon" },
    { id: "collect30", name: "Trophy Hunter", desc: "Earned thirty trophies.", rarity: "uncommon" },
    { id: "collect40", name: "Shelf Filler", desc: "Earned forty trophies.", rarity: "uncommon" },
    { id: "collect50", name: "Half Cabinet", desc: "Earned fifty trophies.", rarity: "rare" },
    { id: "collect60", name: "Dedicated", desc: "Earned sixty trophies.", rarity: "rare" },
    { id: "collect75", name: "So Close", desc: "Earned seventy-five trophies.", secret: true, rarity: "epic" },
    { id: "collect90", name: "Obsessed", desc: "Earned ninety trophies.", secret: true, rarity: "epic" },
    { id: "collect100", name: "Centurion", desc: "Earned one hundred trophies.", secret: true, rarity: "legendary" },
    { id: "grandtour", name: "Grand Tour", desc: "Visited every page in the menu.", secret: true, rarity: "epic" },
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
    { id: "all", name: "Completionist", desc: "Earned every other trophy.", rarity: "platinum" },
    { id: "special", name: "Super Duper Special", desc: "Reserved for the people Anders has made an Admin in Discord.", special: true, rarity: "special" }
  ];

  function tierOf(t) {
    if (t.special) return "special";
    if (t.id === "all") return "platinum";
    return t.rarity || "common";
  }
  var TIER_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", platinum: "Platinum", special: "Special" };
  var RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, platinum: 5, special: 6 };

  var CUP = '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.2a2.6 2.6 0 0 0 2.9 3.6M16 5.5h2.8a2.6 2.6 0 0 1-2.9 3.6M12 13v3.5M8.5 20h7M9.5 20c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>';
  var LOCK = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  var QMARK = '<path d="M9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.8.4-1.5 1-1.5 2v.6"/><circle cx="11.5" cy="17.5" r="1.1" fill="currentColor" stroke="none"/>';

  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  S.ready(function () {
    var progEl = document.getElementById("tr-prog"),
        filtEl = document.getElementById("tr-filters"),
        grid = document.getElementById("tr-grid");
    if (!grid) return;
    var got = S.store.get("trophies", {}) || {};
    var core = CATALOG.filter(function (t) { return !t.special; });
    var earnedCore = core.filter(function (t) { return got[t.id]; }).length;
    var pct = Math.round(earnedCore / core.length * 100);

    /* progress ring */
    if (progEl) {
      var R = 52, C = 2 * Math.PI * R, off = C * (1 - earnedCore / core.length);
      progEl.appendChild(S.el("div", { class: "tr-ring" },
        S.svg('<circle cx="60" cy="60" r="' + R + '" class="tr-ring-bg"/>' +
              '<circle cx="60" cy="60" r="' + R + '" class="tr-ring-fg" pathLength="' + C.toFixed(1) + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>',
              { viewBox: "0 0 120 120", class: "tr-ring-svg", "stroke-width": "9" }),
        S.el("div", { class: "tr-ring-c" }, S.el("b", { text: earnedCore + "/" + core.length }), S.el("span", { text: pct + "%" }))));
      progEl.appendChild(S.el("div", { class: "tr-prog-txt" },
        S.el("b", { text: earnedCore === core.length ? "Completionist!" : "Keep collecting" }),
        S.el("span", { text: earnedCore === core.length ? "You've earned every trophy on the site." : (core.length - earnedCore) + " still to find · saved in this browser only" })));
    }

    /* filter tabs */
    var state = { filter: "all", query: "", sort: "default" };
    var FILTERS = [["all", "All"], ["earned", "Earned"], ["locked", "Locked"], ["secret", "Secret"]];
    var tabs = {};
    FILTERS.forEach(function (f) {
      var b = S.el("button", { class: "tr-tab" + (f[0] === "all" ? " is-on" : ""), type: "button", role: "tab",
        "aria-selected": f[0] === "all" ? "true" : "false",
        onclick: function () { state.filter = f[0]; for (var k in tabs) { tabs[k].classList.toggle("is-on", k === f[0]); tabs[k].setAttribute("aria-selected", k === f[0] ? "true" : "false"); } draw(); } },
        S.el("span", { text: f[1] }));
      tabs[f[0]] = b; if (filtEl) filtEl.appendChild(b);
    });

    /* search + sort */
    var searchEl = document.getElementById("tr-search"),
        sortEl = document.getElementById("tr-sort"),
        countEl = document.getElementById("tr-count");
    if (searchEl) searchEl.addEventListener("input", function () { state.query = searchEl.value.trim().toLowerCase(); draw(); });
    if (sortEl) sortEl.addEventListener("change", function () { state.sort = sortEl.value; draw(); });

    /* what a visitor can actually read on a card — a locked secret shows only placeholder text,
       so searching its real name must never surface it. */
    function shownText(t) {
      var have = !!got[t.id];
      if (t.secret && !have) return "secret trophy keep exploring to reveal this one";
      return (t.name + " " + t.desc).toLowerCase();
    }

    function card(t) {
      var have = !!got[t.id], tier = tierOf(t), hiddenSecret = t.secret && !have;
      var icoInner = have ? CUP : (t.secret ? QMARK : LOCK);
      var name = hiddenSecret ? "Secret trophy" : t.name;
      var desc = hiddenSecret ? "Keep exploring to reveal this one." : t.desc;
      var c = S.el("article", { class: "tr-card tr-" + tier + (have ? " is-got" : " is-locked"), dataset: { tier: tier, got: have ? "1" : "0", secret: t.secret ? "1" : "0" } },
        S.el("span", { class: "tr-ico" }, S.svg(icoInner)),
        S.el("div", { class: "tr-body" },
          S.el("h2", { class: "tr-name", text: name }),
          S.el("p", { class: "tr-desc", text: desc }),
          S.el("div", { class: "tr-foot" },
            S.el("span", { class: "tr-tier", text: TIER_LABEL[tier] }),
            have ? S.el("span", { class: "tr-date", text: "Earned " + fmtDate(got[t.id]) }) : S.el("span", { class: "tr-date tr-date--locked", text: "Locked" }))));
      return c;
    }

    function draw() {
      grid.textContent = "";
      var list = CATALOG.filter(function (t) {
        var have = !!got[t.id];
        if (state.filter === "earned" && !have) return false;
        if (state.filter === "locked" && have) return false;
        if (state.filter === "secret" && !t.secret) return false;
        if (state.query && shownText(t).indexOf(state.query) === -1) return false;
        return true;
      });

      if (state.sort !== "default") {
        /* sort a copy so CATALOG order (the default) is never mutated;
           ties fall back to catalog position so sorting stays stable. */
        var idx = {};
        CATALOG.forEach(function (t, i) { idx[t.id] = i; });
        list = list.slice();
        list.sort(function (a, b) {
          var r = 0;
          if (state.sort === "name") r = a.name.localeCompare(b.name);
          else if (state.sort === "rarity") r = (RARITY_RANK[tierOf(a)] || 0) - (RARITY_RANK[tierOf(b)] || 0);
          else if (state.sort === "rarity-desc") r = (RARITY_RANK[tierOf(b)] || 0) - (RARITY_RANK[tierOf(a)] || 0);
          else if (state.sort === "earned") r = (got[b.id] ? 1 : 0) - (got[a.id] ? 1 : 0);
          else if (state.sort === "locked") r = (got[a.id] ? 1 : 0) - (got[b.id] ? 1 : 0);
          return r || (idx[a.id] - idx[b.id]);
        });
      }

      if (countEl) {
        var total = CATALOG.length;
        countEl.textContent = (state.query || state.filter !== "all")
          ? (list.length + " of " + total + " shown")
          : (total + " trophies");
      }

      if (!list.length) {
        grid.appendChild(S.el("div", { class: "tr-empty", text: state.query ? "No trophies match that search." : "Nothing here yet." }));
        return;
      }
      list.forEach(function (t) { grid.appendChild(card(t)); });
    }
    draw();

    /* opening the cabinet counts as "looked through the trophy list" */
    if (S.trophy) setTimeout(function () { S.trophy("room"); }, 900);
  }, "trophy cabinet");
})();
