/* pages/games.platforms.js: every platform Rate-O-Pedia knows. Shared by the pages (filters, badges, add-a-game)
 * and by tools/rop-catalog (which builds the game lists). The id is what the database stores in games.console and
 * the prefix of each game id ("SNES:chrono-trigger"), so ids must never change once games use them.
 *   wp  = English Wikipedia article of the platform (the catalog builder looks its Wikidata item up from this)
 *   wpx = more Wikipedia articles whose games also count for this platform
 *   qx  = Wikidata items to use as well (where the article lookup misses)
 *   lr  = libretro-database system names (complete cartridge / disc lists for older systems)
 */
export const FAMILIES = [
  ["ps", "PlayStation", "#3f83ff"],
  ["xbox", "Xbox", "#3fbf3f"],
  ["nin", "Nintendo", "#e4000f"],
  ["sega", "Sega", "#1f6fe0"],
  ["pc", "PC & Mac", "#9aa6b4"],
  ["atari", "Atari", "#ff7a1f"],
  ["retro", "Other consoles", "#c069ff"],
  ["comp", "Home computers", "#1ec5b3"],
  ["mobile", "Mobile", "#f0a93b"],
  ["arcade", "Arcade", "#ff6076"],
];

export const PLATFORMS = [
  // PlayStation (PS1, PS2, PSP and PS3 lists come from the emulator databases already in the site)
  { id: "PS1", name: "PlayStation", fam: "ps", wp: "PlayStation (console)", year: 1994 },
  { id: "PS2", name: "PlayStation 2", fam: "ps", wp: "PlayStation 2", year: 2000 },
  { id: "PSP", name: "PlayStation Portable", fam: "ps", wp: "PlayStation Portable", year: 2004 },
  { id: "PS3", name: "PlayStation 3", fam: "ps", wp: "PlayStation 3", year: 2006 },
  { id: "Vita", name: "PlayStation Vita", fam: "ps", wp: "PlayStation Vita", lr: ["Sony - PlayStation Vita"], year: 2011 },
  { id: "PS4", name: "PlayStation 4", fam: "ps", wp: "PlayStation 4", year: 2013 },
  { id: "PS5", name: "PlayStation 5", fam: "ps", wp: "PlayStation 5", year: 2020 },
  // Xbox
  { id: "Xbox", name: "Xbox", fam: "xbox", wp: "Xbox (console)", lr: ["Microsoft - Xbox"], year: 2001 },
  { id: "X360", name: "Xbox 360", fam: "xbox", wp: "Xbox 360", lr: ["Microsoft - Xbox 360"], year: 2005 },
  { id: "XOne", name: "Xbox One", fam: "xbox", wp: "Xbox One", year: 2013 },
  { id: "XSX", name: "Xbox Series X|S", fam: "xbox", wp: "Xbox Series X and Series S", year: 2020 },
  // Nintendo
  { id: "NES", name: "NES / Famicom", fam: "nin", wp: "Nintendo Entertainment System", lr: ["Nintendo - Nintendo Entertainment System"], year: 1983 },
  { id: "FDS", name: "Famicom Disk System", fam: "nin", wp: "Family Computer Disk System", qx: ["Q135321"], lr: ["Nintendo - Family Computer Disk System"], year: 1986 },
  { id: "SNES", name: "Super Nintendo", fam: "nin", wp: "Super Nintendo Entertainment System", lr: ["Nintendo - Super Nintendo Entertainment System"], year: 1990 },
  { id: "N64", name: "Nintendo 64", fam: "nin", wp: "Nintendo 64", lr: ["Nintendo - Nintendo 64"], year: 1996 },
  { id: "GC", name: "GameCube", fam: "nin", wp: "GameCube", lr: ["Nintendo - GameCube"], year: 2001 },
  { id: "Wii", name: "Wii", fam: "nin", wp: "Wii", lr: ["Nintendo - Wii"], year: 2006 },
  { id: "WiiU", name: "Wii U", fam: "nin", wp: "Wii U", lr: ["Nintendo - Wii U"], year: 2012 },
  { id: "Switch", name: "Nintendo Switch", fam: "nin", wp: "Nintendo Switch", year: 2017 },
  { id: "Switch2", name: "Nintendo Switch 2", fam: "nin", wp: "Nintendo Switch 2", year: 2025 },
  { id: "GB", name: "Game Boy", fam: "nin", wp: "Game Boy", lr: ["Nintendo - Game Boy"], year: 1989 },
  { id: "GBC", name: "Game Boy Color", fam: "nin", wp: "Game Boy Color", lr: ["Nintendo - Game Boy Color"], year: 1998 },
  { id: "GBA", name: "Game Boy Advance", fam: "nin", wp: "Game Boy Advance", lr: ["Nintendo - Game Boy Advance"], year: 2001 },
  { id: "DS", name: "Nintendo DS", fam: "nin", wp: "Nintendo DS", lr: ["Nintendo - Nintendo DS"], year: 2004 },
  { id: "3DS", name: "Nintendo 3DS", fam: "nin", wp: "Nintendo 3DS", lr: ["Nintendo - Nintendo 3DS"], year: 2011 },
  { id: "VB", name: "Virtual Boy", fam: "nin", wp: "Virtual Boy", lr: ["Nintendo - Virtual Boy"], year: 1995 },
  { id: "PokeMini", name: "Pokémon Mini", fam: "nin", wp: "Pokémon Mini", lr: ["Nintendo - Pokemon Mini"], year: 2001 },
  // Sega
  { id: "SG1000", name: "SG-1000", fam: "sega", wp: "SG-1000", lr: ["Sega - SG-1000"], year: 1983 },
  { id: "SMS", name: "Master System", fam: "sega", wp: "Master System", lr: ["Sega - Master System - Mark III"], year: 1985 },
  { id: "GEN", name: "Genesis / Mega Drive", fam: "sega", wp: "Sega Genesis", lr: ["Sega - Mega Drive - Genesis"], year: 1988 },
  { id: "SCD", name: "Sega CD", fam: "sega", wp: "Sega CD", lr: ["Sega - Mega-CD - Sega CD"], year: 1991 },
  { id: "32X", name: "32X", fam: "sega", wp: "32X", lr: ["Sega - 32X"], year: 1994 },
  { id: "SAT", name: "Saturn", fam: "sega", wp: "Sega Saturn", lr: ["Sega - Saturn"], year: 1994 },
  { id: "DC", name: "Dreamcast", fam: "sega", wp: "Dreamcast", lr: ["Sega - Dreamcast"], year: 1998 },
  { id: "GG", name: "Game Gear", fam: "sega", wp: "Game Gear", lr: ["Sega - Game Gear"], year: 1990 },
  { id: "Pico", name: "Sega Pico", fam: "sega", wp: "Sega Pico", lr: ["Sega - PICO"], year: 1993 },
  // PC & Mac
  { id: "PC", name: "PC (Windows)", fam: "pc", wp: "Microsoft Windows", year: 1985 },
  { id: "DOS", name: "MS-DOS", fam: "pc", wp: "MS-DOS", wpx: ["IBM PC compatible"], lr: ["DOS"], year: 1981 },
  { id: "Mac", name: "Mac", fam: "pc", wp: "macOS", wpx: ["Classic Mac OS", "Mac (computer)"], qx: ["Q14116", "Q43627", "Q13522376", "Q75687"], year: 1984 },
  { id: "Linux", name: "Linux", fam: "pc", wp: "Linux", year: 1991 },
  // Atari
  { id: "2600", name: "Atari 2600", fam: "atari", wp: "Atari 2600", lr: ["Atari - 2600"], year: 1977 },
  { id: "5200", name: "Atari 5200", fam: "atari", wp: "Atari 5200", lr: ["Atari - 5200"], year: 1982 },
  { id: "7800", name: "Atari 7800", fam: "atari", wp: "Atari 7800", lr: ["Atari - 7800"], year: 1986 },
  { id: "Lynx", name: "Atari Lynx", fam: "atari", wp: "Atari Lynx", lr: ["Atari - Lynx"], year: 1989 },
  { id: "Jaguar", name: "Atari Jaguar", fam: "atari", wp: "Atari Jaguar", wpx: ["Atari Jaguar CD"], lr: ["Atari - Jaguar", "Atari - Jaguar CD"], year: 1993 },
  { id: "ST", name: "Atari ST", fam: "atari", wp: "Atari ST", lr: ["Atari - ST"], year: 1985 },
  { id: "A8", name: "Atari 8-bit", fam: "atari", wp: "Atari 8-bit computers", lr: ["Atari - 8-bit Family"], year: 1979 },
  // other consoles and handhelds
  { id: "CV", name: "ColecoVision", fam: "retro", wp: "ColecoVision", lr: ["Coleco - ColecoVision"], year: 1982 },
  { id: "INTV", name: "Intellivision", fam: "retro", wp: "Intellivision", lr: ["Mattel - Intellivision"], year: 1979 },
  { id: "Vectrex", name: "Vectrex", fam: "retro", wp: "Vectrex", lr: ["GCE - Vectrex"], year: 1982 },
  { id: "O2", name: "Odyssey 2", fam: "retro", wp: "Magnavox Odyssey 2", lr: ["Magnavox - Odyssey2"], year: 1978 },
  { id: "ChanF", name: "Channel F", fam: "retro", wp: "Fairchild Channel F", lr: ["Fairchild - Channel F"], year: 1976 },
  { id: "PCE", name: "TurboGrafx-16", fam: "retro", wp: "TurboGrafx-16", lr: ["NEC - PC Engine - TurboGrafx 16", "NEC - PC Engine SuperGrafx"], year: 1987 },
  { id: "PCECD", name: "TurboGrafx-CD", fam: "retro", wp: "TurboGrafx-CD", lr: ["NEC - PC Engine CD - TurboGrafx-CD"], year: 1988 },
  { id: "PCFX", name: "PC-FX", fam: "retro", wp: "PC-FX", lr: ["NEC - PC-FX"], year: 1994 },
  { id: "NeoGeo", name: "Neo Geo", fam: "retro", wp: "Neo Geo (system)", qx: ["Q1054350", "Q64428080", "Q3338058"], lr: ["SNK - Neo Geo"], year: 1990 },
  { id: "NGCD", name: "Neo Geo CD", fam: "retro", wp: "Neo Geo CD", lr: ["SNK - Neo Geo CD"], year: 1994 },
  { id: "NGP", name: "Neo Geo Pocket", fam: "retro", wp: "Neo Geo Pocket Color", wpx: ["Neo Geo Pocket"], lr: ["SNK - Neo Geo Pocket", "SNK - Neo Geo Pocket Color"], year: 1998 },
  { id: "WS", name: "WonderSwan", fam: "retro", wp: "WonderSwan", wpx: ["WonderSwan Color"], lr: ["Bandai - WonderSwan", "Bandai - WonderSwan Color"], year: 1999 },
  { id: "3DO", name: "3DO", fam: "retro", wp: "3DO Interactive Multiplayer", qx: ["Q229429"], lr: ["The 3DO Company - 3DO"], year: 1993 },
  { id: "CDi", name: "CD-i", fam: "retro", wp: "CD-i", lr: ["Philips - CD-i"], year: 1991 },
  { id: "NGage", name: "N-Gage", fam: "retro", wp: "N-Gage (device)", qx: ["Q336434"], year: 2003 },
  { id: "Arcadia", name: "Arcadia 2001", fam: "retro", wp: "Arcadia 2001", lr: ["Emerson - Arcadia 2001"], year: 1982 },
  { id: "SV", name: "Watara Supervision", fam: "retro", wp: "Watara Supervision", lr: ["Watara - Supervision"], year: 1992 },
  { id: "GCom", name: "Game.com", fam: "retro", wp: "Game.com", lr: ["Tiger - Game.com"], year: 1997 },
  // home computers
  { id: "Amiga", name: "Amiga", fam: "comp", wp: "Amiga", lr: ["Commodore - Amiga"], year: 1985 },
  { id: "C64", name: "Commodore 64", fam: "comp", wp: "Commodore 64", lr: ["Commodore - 64"], year: 1982 },
  { id: "VIC20", name: "VIC-20", fam: "comp", wp: "VIC-20", lr: ["Commodore - VIC-20"], year: 1980 },
  { id: "ZX", name: "ZX Spectrum", fam: "comp", wp: "ZX Spectrum", lr: ["Sinclair - ZX Spectrum", "Sinclair - ZX Spectrum +3"], year: 1982 },
  { id: "MSX", name: "MSX", fam: "comp", wp: "MSX", lr: ["Microsoft - MSX", "Microsoft - MSX2"], year: 1983 },
  { id: "CPC", name: "Amstrad CPC", fam: "comp", wp: "Amstrad CPC", lr: ["Amstrad - CPC"], year: 1984 },
  { id: "X68K", name: "X68000", fam: "comp", wp: "X68000", lr: ["Sharp - X68000"], year: 1987 },
  { id: "PC98", name: "PC-98", fam: "comp", wp: "PC-9800 series", lr: ["NEC - PC-98"], year: 1982 },
  { id: "Apple2", name: "Apple II", fam: "comp", wp: "Apple II", year: 1977 },
  // mobile
  { id: "iOS", name: "iPhone / iPad", fam: "mobile", wp: "iOS", qx: ["Q48493"], year: 2008 },
  { id: "Android", name: "Android", fam: "mobile", wp: "Android (operating system)", year: 2008 },
  // arcade
  { id: "Arcade", name: "Arcade", fam: "arcade", wp: "Arcade video game", year: 1971 },
];

export const PLATFORM = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
export const FAMILY = Object.fromEntries(FAMILIES.map(([k, name, color]) => [k, { k, name, color }]));
export const platformName = (id) => (PLATFORM[id] ? PLATFORM[id].name : id);
export const familyOf = (id) => (PLATFORM[id] ? PLATFORM[id].fam : "retro");
