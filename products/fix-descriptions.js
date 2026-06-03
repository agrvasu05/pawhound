require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const path = require('path');
const { execFileSync } = require('child_process');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CLI = path.join(process.env.HOME, 'go', 'bin', 'gumroad');
const g = (args) => execFileSync(CLI, args, { env: { ...process.env }, encoding: 'utf-8', maxBuffer: 1 << 26 });

(async () => {
  const list = JSON.parse(g(['products', 'list', '--json'])).products;
  const broken = list.filter((p) => {
    const d = (p.description || '').trim();
    return d === '' || d === 'undefined';
  });
  console.log(`Found ${broken.length} products with missing descriptions.`);
  for (const p of broken) {
    const r = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You write warm, concise Gumroad product descriptions for printable digital downloads (Pinterest/home/dog audience). US English.' },
        { role: 'user', content: `Product: "${p.name}". Write a 110-160 word description in simple HTML (<p> and one <ul>). Cover: what's included, that it's an instant digital download to print at home (or use on a tablet), a use case, and that it's for personal use only. No price.` },
      ],
      temperature: 0.7,
    });
    const html = r.choices[0].message.content.trim();
    g(['products', 'update', p.id, '--description', html, '--json']);
    console.log(`  ✓ ${p.name.slice(0, 45)}`);
  }
  console.log('Done.');
})();
