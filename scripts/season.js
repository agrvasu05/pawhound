/**
 * season.js — is a topic in season for Pinterest right now?
 *
 * Pinterest users plan 45–60 days ahead, so each seasonal window opens early and
 * closes AT the event (a Father's Day pin in October is wasted reach and reads
 * as a stale account). Used at post time by scripts/5-post-pins.js (guides) and
 * products/lib.js postQueue (shop pins), so it applies however the queues are
 * rebuilt. Text that matches no season is evergreen and always allowed.
 *
 * Rules are checked in order and the first match wins, so specific phrases
 * ("christmas in july") come before general ones ("christmas").
 */
const RULES = [
  { name: 'christmas-in-july', re: /christmas[\s-]*in[\s-]*july/, windows: [['06-01', '07-25']] },
  { name: 'fourth-of-july', re: /(4th|fourth)[\s-]*of[\s-]*july|independence[\s-]*day|patriotic/, windows: [['05-10', '07-04']] },
  { name: 'valentines', re: /valentine/, windows: [['12-20', '02-14']] },
  { name: 'st-patricks', re: /st[\s-]*patrick|shamrock/, windows: [['02-01', '03-17']] },
  { name: 'easter', re: /easter/, windows: [['02-15', '04-20']] },
  { name: 'mothers-day', re: /mother[\s'’-]*s?[\s-]*day/, windows: [['03-20', '05-12']] },
  { name: 'fathers-day', re: /father[\s'’-]*s?[\s-]*day/, windows: [['04-25', '06-21']] },
  { name: 'graduation', re: /graduat|\bgrad\b|class[\s-]*of[\s-]*20/, windows: [['03-25', '06-15']] },
  { name: 'teacher', re: /teacher/, windows: [['03-25', '05-08'], ['06-15', '09-15']] },
  { name: 'back-to-school', re: /back[\s-]*to[\s-]*school|\bdorm\b|college[\s-]*(dorm|room|essentials|checklist)|first[\s-]*day[\s-]*of[\s-]*school/, windows: [['06-15', '09-10']] },
  { name: 'summer', re: /summer|pool[\s-]*party/, windows: [['04-10', '08-20']] },
  { name: 'spring', re: /spring/, windows: [['02-01', '05-20']] },
  { name: 'halloween', re: /halloween|spooky|jack[\s-]*o[\s-]*lantern|\bwitch|\bghost|haunted|trick[\s-]*or[\s-]*treat|trunk[\s-]*or[\s-]*treat|\bmummy\b|pumpkin[\s-]*(paint|carv|stencil)|(paint|carv)\w*[\s-]*pumpkin|costume/, windows: [['08-25', '10-29']] },
  { name: 'thanksgiving', re: /thanksgiving|friendsgiving/, windows: [['09-20', '11-26']] },
  { name: 'christmas', re: /christmas|xmas|holiday|santa|advent|stocking|ornament|gingerbread|nativity/, windows: [['10-01', '12-24']] },
  { name: 'new-year', re: /new[\s-]*year/, windows: [['11-20', '01-10']] },
  { name: 'fall', re: /\bfall\b|autumn|pumpkin|harvest/, windows: [['07-25', '11-20']] },
  { name: 'winter', re: /winter|snow/, windows: [['10-15', '02-20']] },
];

const md = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const inWindow = (today, [from, to]) => (from <= to ? today >= from && today <= to : today >= from || today <= to);

/** Which seasonal rule a piece of text belongs to, or null if evergreen. */
function seasonOf(text) {
  const t = String(text || '').toLowerCase().replace(/[-_]+/g, ' ');
  for (const r of RULES) if (r.re.test(t)) return r;
  return null;
}

/** True when the text is evergreen or its season's window includes `date`. */
function inSeason(text, date = new Date()) {
  const r = seasonOf(text);
  if (!r) return true;
  const today = md(date);
  return r.windows.some((w) => inWindow(today, w));
}

module.exports = { inSeason, seasonOf, RULES };
