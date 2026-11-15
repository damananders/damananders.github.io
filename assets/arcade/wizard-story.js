/* arcade/wizard-story.js — every story beat and line of dialogue in Wizard of the Sprint, in one place.
 * The game reads its text from here. The control panel's Wizard Story page reads the same list to build its editor, so a
 * beat added here shows up there with no other change. The owner's edits are saved in the site config under "wizardStory"
 * ({ beatId: [lines] }) and laid over these defaults. When a level or a new kind of line is added to the game, add its
 * beat here: id, title, when it plays, how it is shown, a continuity tip, and the default lines. */
(function () {
  "use strict";
  var GROUPS = [], BEATS = [], BY = {};
  function group(title, note) { GROUPS.push({ title: title, note: note, beats: [] }); }
  function beat(id, title, when, how, tip, lines) { var b = { id: id, title: title, when: when, how: how, tip: tip, lines: lines }; GROUPS[GROUPS.length - 1].beats.push(b); BEATS.push(b); BY[id] = b; }


  group("Story panels", "The big beats. These tell the plot, so they are the ones to write first.");
  beat("open", "Opening",
    "Once, right after the wizard is created, before the tower hub first appears.",
    "Full-screen parchment panel. Each line is its own panel, shown in order with a Next button.",
    "Has to land: all-knowing and bored, the nap, the theft, waking in sleep cap and skivvies, footprints leading out, fear turning into motivation. The wizard starts out pompous, so there is room to soften later. Keep the thief unseen and unnamed.",
    [
      "{Name} the All-Knowing had nothing left to learn, nobody worth fearing, and nobody worth caring about. So {Name} took a nap. A long, magickal one.",
      "SNAP.  FLASH.  BOOM.",
      "Morning. The tomes: gone. The robes: shredded. The wands, swords and bows: missing or melted. There is a hole in the tower where the library used to be.",
      "{Name} is wearing a sleep cap, a stained tunic and some deeply questionable skivvies. In the mud by the hole is a trail of footprints.",
      "For the first time in centuries, {Name} is afraid. And furious. And... motivated?"
    ]);
  beat("clear1", "After the forest (level 1)",
    "Once, after the Grand Mud Imp is beaten for the first time, when you press Continue on the results screen.",
    "Full-screen parchment panel. Each line is its own panel, shown in order with a Next button.",
    "Has to land: hat won back from a mud imp, the tracks point to a tavern (level 2), the tower still has no roof and a scroll held overhead is the first repair. The thief stays unseen.",
    [
      "Your hat, back from a mud imp! The tracks lead on, toward a tavern.",
      "Back home it is still raining through the roof you do not have. You hold a soggy scroll over your head. It's a start."
    ]);

  group("Wizard speech during a run", "Short bubbles the wizard says while running. Keep each under about 60 characters so it fits the bubble.");
  beat("early", "Idle chatter, first half",
    "Every 16 to 28 seconds while running, when no other bubble is showing and no boss is out. Used in the first half of level 1 and in Endless (mixed half and half with the next list).",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Grumpy, pampered, shocked to be outdoors. Early in the story he is still pompous.",
    [
      "I used to have SO many hats.",
      "Running. Me. Disgusting.",
      "Whoever did this is getting a strongly worded hex.",
      "My feet are touching MUD.",
      "I have not jogged since the Third Age.",
      "These skivvies were not built for speed.",
      "Is this what 'cardio' is? I hate it.",
      "I knew everything yesterday. EVERYTHING.",
      "Footprints. Rude, muddy footprints.",
      "A nap. One nap. And THIS.",
      "My knees are filing a complaint.",
      "I could have teleported. I HAD a spell for that.",
      "Note to self: lock the tower.",
      "The forest smells like... outside.",
      "Fresh air. Ugh."
    ]);
  beat("mid", "Idle chatter, mixed in",
    "Same timing as above. Shares the first half of level 1 and all of Endless with the list above.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Complaining, but starting to notice the world.",
    [
      "Do imps always look this smug?",
      "I am sweating. Wizards do not sweat.",
      "That squirrel judged me. I felt it.",
      "Somewhere, someone is wearing my robes.",
      "I miss my chair.",
      "Left foot, right foot. Riveting.",
      "If I find my wand I'm never putting it down.",
      "Who steals a whole LIBRARY?",
      "I had a tome for blisters. HAD.",
      "The audacity. The sheer audacity.",
      "I'd turn them into a newt if I remembered how.",
      "Poof. Poof. Is that all I've got? Poof?",
      "Still got it. Sort of. A bit.",
      "Mud between the toes. Delightful. No.",
      "This is fine. I'm fine. Everything is fine."
    ]);
  beat("late", "Idle chatter, second half",
    "Same timing, but only in the second half of level 1 as the boss gets close.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "The tracks are fresher. First hints he is enjoying himself and softening.",
    [
      "The tracks are fresher here.",
      "I can smell my own hat. Don't ask.",
      "Closer. I can feel it in my beard.",
      "Whoever you are, I'm RIGHT behind you.",
      "Getting the hang of this running thing.",
      "Huh. I haven't thought about tax scrolls in an hour.",
      "Is this... am I having FUN? No. Surely not.",
      "Something big is up ahead. Wonderful.",
      "My legs have stopped screaming. Suspicious."
    ]);
  beat("greet", "Greeting a friendly",
    "When the wizard runs past a deer, squirrel or forager without high-fiving. About half of those passes (the rest are the creature cheering, or rarely the apology).",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Awkward small talk from someone who has not spoken to anyone in centuries.",
    [
      "Morning! Don't mind the pyjamas.",
      "Lovely day for being robbed.",
      "Seen a thief? Tall? Short? Any size?",
      "Hello, small woodland citizen.",
      "Carry on. Wizard business.",
      "Nice fur. Very... furry.",
      "Have you seen a library go by?",
      "You there! Good job existing.",
      "Out of the way, I'm exercising!",
      "I'd stop to chat, but, you know. Vengeance."
    ]);
  beat("sorry", "The apology",
    "Rare. About 1 pass in 15, and never more than once a minute. The creature answers with a line from 'Reply to the apology'.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Your line. It is the seed of him becoming kinder, so it should stay rare.",
    [
      "Sorry if I was ever a dick!"
    ]);
  beat("five", "High five landed",
    "When you press High Five as you pass a friendly and it connects.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Pure delight. He likes this more than he expected.",
    [
      "Up high!",
      "Yes! Contact!",
      "Nailed it.",
      "Skin! Or fur! Whatever!",
      "Still got the reflexes.",
      "Best part of my day, honestly.",
      "Put it there!"
    ]);
  beat("rescue", "Freed a caged squirrel family",
    "When the wizard touches a cage on the path.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Gruff outside, soft inside.",
    [
      "You're safe. Don't make it weird.",
      "Fine. FINE. You're welcome.",
      "Out you get. No hugging.",
      "Freedom! Now scram.",
      "I'm not crying. It's forest in my eye."
    ]);
  beat("hit", "Took a hit and survived",
    "When an enemy or hazard hurts the wizard but does not end the run.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "Wounded pride more than pain.",
    [
      "Ow, my dignity.",
      "That's going in my diary.",
      "Right in the pyjamas!",
      "I felt that in a previous century.",
      "Rude!",
      "My everything hurts."
    ]);
  beat("orb", "Picked up the first Whisper Orb",
    "Once per save, on the first Whisper Orb, when the first buff is unlocked.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "",
    [
      "Ooh, that tingles. I remember tingles.",
      "Whispers! I love gossip.",
      "Yes. YES. Power. A little bit of it."
    ]);
  beat("grim", "Picked up a Grimoire",
    "Half of the time a Grimoire is collected.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "He misses his books.",
    [
      "MY BOOK! ...wait, not mine. Mine now.",
      "A book! I remember reading.",
      "Finders keepers, that's the law."
    ]);
  beat("satchel", "Found the lost satchel",
    "When the very rare satchel is collected (it gives the Ward incantation).",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "",
    [
      "Somebody's mail is late. Too bad."
    ]);
  beat("boss", "The boss arrives",
    "When the Grand Mud Imp walks in at the end of level 1, and each time it returns in Endless. Shown a little longer than other bubbles.",
    "Speech bubble over the wizard for about 2 seconds. One line is picked at random each time, never the same one twice in a row.",
    "The imp is wearing his hat.",
    [
      "Oh, you're big. I hate that.",
      "Is that MY HAT?",
      "That is a LOT of imp."
    ]);

  group("Friendly creatures", "What the deer, squirrels and foragers say back.");
  beat("cheer", "Creature cheers him on",
    "When the wizard passes a friendly without a high five. A bit under half of those passes.",
    "Speech bubble over the friendly creature for about 2 seconds. One line is picked at random each time.",
    "They find him funny, not scary. He is in his pyjamas.",
    [
      "Go get 'em, weird old wizard!",
      "Nice jammies!",
      "Run, wizard, run!",
      "Looking spry, grandpa!",
      "Love the cap!",
      "You dropped your dignity back there!",
      "Wooo! Mystery jogger!",
      "Is that the tower hermit? RUNNING?",
      "Knees up, old timer!",
      "You've got this, pyjama person!"
    ]);
  beat("greetReply", "Reply to his greeting",
    "About a second after one of the wizard's greeting lines.",
    "Speech bubble over the friendly creature for about 2 seconds. One line is picked at random each time.",
    "Baffled.",
    [
      "...okay?",
      "He seems nice.",
      "That man has no trousers.",
      "Wizards. Honestly.",
      "Should we tell someone?",
      "Bye, weird wizard!",
      "Good luck with... that!"
    ]);
  beat("reply", "Reply to the apology",
    "About a second after the apology line.",
    "Speech bubble over the friendly creature for about 2 seconds. One line is picked at random each time.",
    "They have no idea who he is.",
    [
      "Uh... thanks?",
      "You were, though.",
      "Apology noted.",
      "A bit, yeah.",
      "Water under the bridge!",
      "Who ARE you?"
    ]);

  group("Screen text", "Story-flavoured text on menus.");
  beat("hub0", "Tower menu, before the forest is cleared",
    "Under the tower's name on the main menu, until level 1 is beaten.",
    "Small text under the title of a menu. Only the first line is used.",
    "",
    [
      "Robbed, roofless and in your pyjamas. The footprints lead into the forest."
    ]);
  beat("hub1", "Tower menu, after the forest is cleared",
    "Under the tower's name on the main menu, once level 1 is beaten.",
    "Small text under the title of a menu. Only the first line is used.",
    "Update this as later levels arrive.",
    [
      "Still no roof, but you have a scroll to hold over your head. The tracks lead on to a tavern (coming next)."
    ]);
  beat("win1", "Results screen, forest cleared",
    "Under 'Forest Cleared' when the boss is beaten.",
    "Small text under the title of a menu. Only the first line is used.",
    "",
    [
      "The Grand Mud Imp drops your hat and runs."
    ]);
  beat("lose", "Results screen, run ended",
    "Under 'Flattened at ... m' when a run ends without beating the boss.",
    "Small text under the title of a menu. Only the first line is used.",
    "",
    [
      "You keep everything you picked up."
    ]);

  var over = {};
  function clean(v) { return Array.isArray(v) ? v.map(function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, 600); }).filter(Boolean).slice(0, 60) : null; }
  window.WizStory = {
    groups: GROUPS, beats: BEATS,
    /* the owner's saved edits: { beatId: [lines] }. Anything missing, empty or malformed falls back to the default. */
    apply: function (o) { over = {}; if (o && typeof o === "object") for (var k in o) { var c = clean(o[k]); if (BY[k] && c && c.length) over[k] = c; } },
    lines: function (id) { return over[id] || (BY[id] ? BY[id].lines : [""]); },
    first: function (id) { return this.lines(id)[0] || ""; },
    clean: clean
  };
})();
