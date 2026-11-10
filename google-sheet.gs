/** @OnlyCurrentDoc  (the script can only open the sheet it's attached to, none of your other files) */

/*
 * Building Jerusillion: the quiz-setter's log.
 *
 * This lives in a Google Sheet, not on the website. The game sends it a row for every answered
 * prompt and every finished game. README.md ("Seeing who played") has the setup steps.
 *
 *   Answers  one row per prompt: who, what they got wrong, what they typed and what it matched
 *   Games    one row per finished game: who and how high they got
 *   Summary  for each day: how many people played, the average and the best
 */

const TABS = {
  answer: {
    name: "Answers",
    headers: ["Time", "Name", "Player", "No.", "Date", "Kind", "Prompt #", "Prompt",
              "Wrong guesses", "Typed", "Answer", "Tier", "Metres"],
  },
  game: {
    name: "Games",
    headers: ["Time", "Name", "Player", "No.", "Date", "Kind", "Metres", "Height", "Icons"],
  },
};

// Run this once from the editor (pick "setup", press Run). It makes the tabs and asks for permission.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  tab(ss, "answer");
  tab(ss, "game");
  summary(ss);
  const blank = ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

// The game posts here.
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents);
    if (!TABS[d.type]) return reply("ignored");
    lock.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const who = [new Date(), text(d.name), text(d.player), num(d.number), text(d.date), text(d.kind)];
    const what = d.type === "answer"
      ? [num(d.prompt), text(d.question), text([].concat(d.wrong || []).join(" · ")),
         text(d.typed), text(d.answer), text(d.tier), num(d.metres)]
      : [num(d.metres), text(d.height), text(d.icons)];
    tab(ss, d.type).appendRow(who.concat(what));
    return reply("ok");
  } catch (err) {
    return reply("error");
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app link in a browser shows this, so you can check it's live.
function doGet() {
  return reply("The Building Jerusillion log is running.");
}

function tab(ss, type) {
  const t = TABS[type];
  let sheet = ss.getSheetByName(t.name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(t.name);
  sheet.appendRow(t.headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, t.headers.length).setFontWeight("bold");
  sheet.getRange("A:A").setNumberFormat("ddd d mmm, h:mm am/pm");
  return sheet;
}

function summary(ss) {
  if (ss.getSheetByName("Summary")) return;
  const sheet = ss.insertSheet("Summary", 0);
  sheet.getRange("A1").setFormula(
    `=IFERROR(QUERY(Games!A:I, "select D, E, count(C), avg(G), max(G) ` +
    `where F <> 'Practice' and C is not null group by D, E order by D desc ` +
    `label D 'No.', E 'Date', count(C) 'Players', avg(G) 'Average m', max(G) 'Best m' ` +
    `format avg(G) '0'", 1), "No games yet")`
  );
  sheet.getRange("A1:E1").setFontWeight("bold");
  sheet.getRange("G1").setValue("Players counts each phone (or browser) once per day. Practice goes aren't counted.");
}

// A leading apostrophe keeps guesses as plain text: "=1+1" or "007" go in exactly as typed.
function text(v) {
  if (v === undefined || v === null || v === "") return "";
  return "'" + String(v).slice(0, 300);
}

function num(v) {
  return typeof v === "number" && isFinite(v) ? v : "";
}

function reply(s) {
  return ContentService.createTextOutput(s);
}
