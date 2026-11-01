# Building Jerusillion

The daily St Paul's College quiz. Each day brings a handful of prompts like *"Name a cocktail"*, with 20 seconds for each. Any right answer scores, but obvious answers barely count. The rarer your answer, the higher your maroon and gold balloon climbs:

| Tier | Climb |
| --- | --- |
| 🍷 Wine Glass (the obvious ones) | 10 m |
| 💍 Rings | 25 m |
| 🎹 Piano | 50 m |
| 🏆 Chalice | 75 m |
| ⚔️ Crossed Swords (nobody will think of it) | 100 m |

The balloon starts on the lawn at St Paul's. As it rises, the college drops away and Sydney Uni comes into view, then the Harbour Bridge and the city, the clouds, a sunset, twilight and the Southern Cross. A perfect day (every answer Crossed Swords) reaches the golden Jerusalem at the very top.

Players get one go per day on each device. When they finish, they can share their height and icon row to the group chat without giving away any answers.

## Posting a new day

All the prompts live in [`puzzles.txt`](puzzles.txt). To add a day:

1. Open `puzzles.txt` on GitHub and tap the pencil icon. This works fine on a phone.
2. Add a block like this anywhere in the file:

   ```
   2026-10-31

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
   - You can use any number of prompts per day. Five works well. A perfect day always reaches Jerusalem, however many prompts there are.
3. Commit. The site updates within a minute or so.
4. **Check the day before you post the link** by opening `…/?preview=2026-10-31`. Preview mode lets you play that day without saving anything. It also lists any lines in `puzzles.txt` it couldn't understand.
5. Post the link in the chat. It's the same link every day, and the puzzle switches over at midnight Sydney time.

You can write days in advance. Each one goes live on its own date.

## Handy links

- `/` is today's puzzle.
- `/?preview` is today's puzzle in preview mode, which saves nothing.
- `/?preview=YYYY-MM-DD` previews any day, including future ones.
- `/?archive` lists past puzzles. Anyone who missed a day can play it there, but it won't count toward their streak.

## Hosting

This is a plain static site with no build step and no server, so it runs on GitHub Pages:

1. Push this repo to GitHub.
2. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then **main** and **/ (root)**. Save.
3. After a minute, the game is live at `https://lockiewalter.github.io/St-Krillion/`.

The link preview in group chats uses `og.png`. If the site ever moves to a different address, update the two `og:` URLs in `index.html`.

To change the name, the timer length or the time zone, edit `CONFIG` at the top of `app.js`. The layers of sky and their names are in `BANDS` just below it. All the pixel art (the college, Sydney Uni, the city, the sky, the balloon and the icons) is drawn in code in `scene.js`.

## Good to know

- Scores are kept in each player's browser, so there's no sign-up, but there's also no shared leaderboard. The group chat is the leaderboard.
- `puzzles.txt` is public. Anyone determined enough can read the answers. The 20-second clock keeps most people honest.
