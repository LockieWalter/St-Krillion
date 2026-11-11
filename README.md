# Building Jerusillion

The daily St Paul's College quiz. Each day brings a handful of prompts like *"Name a cocktail"*, with 25 seconds for each. Any right answer scores, but obvious answers barely count. The rarer your answer, the higher your maroon and gold balloon climbs:

| Tier | Climb |
| --- | --- |
| 🍷 Wine Glass (the obvious ones) | 10 m |
| 💍 Rings | 25 m |
| 🎹 Piano | 50 m |
| 🏆 Chalice | 75 m |
| ⚔️ Crossed Swords (nobody will think of it) | 100 m |

There's also a secret tier, **1 in a Jerusillion** (a `jerusillion:` line in `puzzles.txt`). That answer is worth whatever it takes to reach the top: the balloon jumps straight to Jerusalem, fireworks go off, and the game ends there. It never shows up in the "Rarer" hints.

The balloon starts on the lawn at St Paul's. As it rises, the college drops away and Sydney Uni comes into view, then the Harbour Bridge and the city, the clouds, a sunset, twilight and the Southern Cross. A perfect day (every answer Crossed Swords) reaches the golden Jerusalem at the very top.

Players get one real go per day on each device. When they finish, they can share their height and icon row to the group chat without giving away any answers. After that they can have as many practice goes as they like. Practice goes are labelled "Practice attempt", can't be shared, and never replace the real score.

## Posting a new day

All the prompts live in [`puzzles.txt`](puzzles.txt). To add a day:

1. Open `puzzles.txt` on GitHub and tap the pencil icon. This works fine on a phone.
2. Add a block like this anywhere in the file:

   ```
   2026-11-03

   Q: Name a Sydney beach
   wine:    Bondi, Manly, Coogee
   rings:   Bronte, Cronulla, Maroubra
   piano:   Clovelly, Balmoral, Freshwater / Freshie
   chalice: Gordons Bay, Little Bay, Mona Vale
   swords:  Congwong Bay / Congwong, Milk Beach

   Q: Name a cocktail
   wine:    Margarita, Mojito
   ...
   ```

   - The tier words run from most to least common: **wine, rings, piano, chalice, swords**. `1:` to `5:` work too, and so do the old `fools/bronze/silver/gold/lode` words.
   - Separate answers with commas. Put alternate spellings after a slash (`Freshwater / Freshie`).
   - Capitals, punctuation, "the", plurals, accents, typos and shortenings are forgiven automatically. "Vet" counts as Veterinary Medicine, "Mech Eng" as Mechanical Engineering, "Dining" as Dining Hall. A guess that could be several answers gets the most common one. Nicknames that aren't shortenings (Sals, Jim's, ABC) still need listing.
   - Any answer that isn't listed scores 0, so list generously.
   - Spread each list roughly evenly, about a fifth in each tier, so most right answers climb more than the bare 10 m.
   - Players can also type just part of an answer, as long as it fits only one: "Statistician" for Fresher Statistician, "Dark Satanic Mills" for the whole hymn line. A guess made only of words from the prompt (like "Fresher") doesn't count.
   - You can use any number of prompts per day. Five works well. A perfect day always reaches Jerusalem, however many prompts there are.
3. Commit. The site updates within a minute or so.
4. **Check the day** by opening `…/?preview=2026-11-03`. Preview mode lets you play that day without saving anything. It also lists any lines in `puzzles.txt` it couldn't understand.
5. **Post its link.** The preview has a **Copy link** button for that day's own link, like `…/?day=2` for No. 2. Paste it into the Facebook group (or any chat) on the day.

Each day's link always opens that day's puzzle:

- **On its day**, it's the real thing: one go each, and it counts toward streaks.
- **After its day**, it still plays, as an archive game, so anyone who scrolls past the post late can have a go.
- **Before its day**, it just says when it opens, so posting early doesn't give anything away.

The plain address, `…/St-Krillion/`, always opens whatever is on today. You can write days in advance; each one goes live at midnight Sydney time on its date. Puzzles are numbered in date order, so add new days after the old ones rather than before, or the numbers in old links will shift.

## Handy links

- `/` is today's puzzle.
- `/?day=N` is puzzle No. N. This is the link to post each day.
- `/?preview` is today's puzzle in preview mode, which saves nothing.
- `/?reset` forgets every game played on the device that opens it, so you can play a day for real again while testing. Facebook's in-app browser and Safari or Chrome keep separate games, so reset in whichever one you test in.
- `/?preview=YYYY-MM-DD` (or `/?preview=N`) previews any day, including future ones.
- `/?archive` lists past puzzles. Anyone who missed a day can play it there, but it won't count toward their streak.

## Hosting

This is a plain static site with no build step and no server, so it runs on GitHub Pages:

1. Push this repo to GitHub.
2. Make the repo public: **Settings → General**, scroll to *Danger Zone*, **Change visibility → Public**. GitHub Pages only works on public repos with a free account. (The answers are readable on the live site either way.)
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then **main** and **/ (root)**. Save.
4. After a minute or two, the game is live at `https://lockiewalter.github.io/St-Krillion/`.

The link preview in Facebook and group chats uses `og.png`. If the site ever moves to a different address, update the `og:image` URL in `index.html`. There's deliberately no `og:url` tag: Facebook would send every `?day=N` link to that one address instead.

To see how a link will look on Facebook (or to refresh a preview after changing `og.png`), paste it into Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) and press **Scrape Again**.

To change the name, the timer length or the time zone, edit `CONFIG` at the top of `app.js`. The layers of sky and their names are in `BANDS` just below it. All the pixel art (the college, Sydney Uni, the city, the sky, the balloon and the icons) is drawn in code in `scene.js`.

## Seeing who played

The game can quietly record every play in a Google Sheet that only you can open. Players see nothing different, except a **Your name (optional)** box just under *Start climbing*. Filling it in is optional, and the name is remembered on their phone. Without a name, their answers still come through under a random player code like `k3x9q2`.

The sheet gets three tabs:

- **Summary** lists each day with how many people played, the average height and the best.
- **Answers** has one row per prompt: the name, the player code, the guesses that weren't on the list, what they typed, the answer it matched and the tier. The wrong guesses are a good place to find answers worth adding to `puzzles.txt`.
- **Games** has one row per finished game, with the height and the icon row.

Each row's *Kind* is **On the day**, **Archive** or **Practice**. Preview mode records nothing, so checking a day doesn't add rows. Like scores, the player code belongs to one browser: Facebook's in-app browser and Safari on the same phone show up as two players.

To set it up (about five minutes, once):

1. Make a new Google Sheet ([sheets.new](https://sheets.new)) and call it something like *Jerusillion log*.
2. Choose **Extensions → Apps Script**. Delete the code that's there, paste in everything from [`google-sheet.gs`](google-sheet.gs), and press **Save**.
3. In the toolbar, choose **setup** from the function list and press **Run**. Google asks for permission. Pick your account. Google then warns that it "hasn't verified this app", with you named as the developer. That warning shows for every personal script, because only published apps get verified. Choose **Advanced → Go to … (unsafe) → Allow**. The script can only open this one sheet. The sheet now has the three tabs.
4. Choose **Deploy → New deployment**. Click the gear and pick **Web app**. Set *Execute as* to **Me** and *Who has access* to **Anyone**, then **Deploy**. Copy the **Web app URL**. It ends in `/exec`.
5. In `app.js`, paste that link between the quotes of `logUrl: ""` near the top, and commit.
6. Check it: open the game and play (a practice go counts too). Rows should appear in the sheet within a few seconds.

If you ever change the script, use **Deploy → Manage deployments**, edit the deployment and choose **New version**. That keeps the same link.

To stop recording, empty `logUrl` again. The name box disappears with it.

## Good to know

- Scores are kept in each player's browser, so there's no sign-up, but there's also no shared leaderboard. The group is the leaderboard: the **Share your climb** button copies a spoiler-free score with that day's link, ready to paste as a comment.
- Tapping a link inside the Facebook app opens Facebook's own browser, which keeps its own scores. Opening the same link in Safari or Chrome counts as a different device.
- `puzzles.txt` is public. Anyone determined enough can read the answers. The 25-second clock keeps most people honest.
