require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 3 batches of 50 breeds each — different groups for variety
const BREED_BATCHES = [
  'Golden Retriever, Labrador Retriever, German Shepherd, French Bulldog, Bulldog, Standard Poodle, Miniature Poodle, Beagle, Rottweiler, German Shorthaired Pointer, Siberian Husky, Dachshund, Doberman Pinscher, Great Dane, Australian Shepherd, Boxer, Border Collie, Cavalier King Charles Spaniel, Shih Tzu, Boston Terrier, Pembroke Welsh Corgi, Havanese, Shetland Sheepdog, Bernese Mountain Dog, Pomeranian, Maltese, Weimaraner, Cocker Spaniel, Vizsla, Irish Setter, English Springer Spaniel, Flat-Coated Retriever, Chesapeake Bay Retriever, Nova Scotia Duck Tolling Retriever, Brittany, Boykin Spaniel, Lagotto Romagnolo, Spinone Italiano, Bracco Italiano, Nederlandse Kooikerhondje, Pointer, English Setter, Gordon Setter, Irish Red and White Setter, Clumber Spaniel, Sussex Spaniel, Field Spaniel, Irish Water Spaniel, American Water Spaniel, Curly-Coated Retriever',
  'Yorkshire Terrier, Jack Russell Terrier, Bull Terrier, Airedale Terrier, West Highland White Terrier, Scottish Terrier, Cairn Terrier, Wire Fox Terrier, Miniature Schnauzer, Standard Schnauzer, Giant Schnauzer, Bloodhound, Greyhound, Whippet, Basset Hound, Afghan Hound, Saluki, Irish Wolfhound, Borzoi, Scottish Deerhound, Rhodesian Ridgeback, Akita, Alaskan Malamute, Samoyed, Chow Chow, Saint Bernard, Newfoundland, Leonberger, Greater Swiss Mountain Dog, Mastiff, Bullmastiff, Cane Corso, Neapolitan Mastiff, Tibetan Mastiff, Dogue de Bordeaux, Boerboel, Kangal Shepherd Dog, Anatolian Shepherd, Great Pyrenees, Komondor, Kuvasz, Belgian Malinois, Belgian Tervuren, Belgian Sheepdog, Bouvier des Flandres, Briard, Black Russian Terrier, Staffordshire Bull Terrier, American Staffordshire Terrier, Soft Coated Wheaten Terrier',
  'Chihuahua, Pug, Toy Poodle, Bichon Frise, Papillon, Italian Greyhander, Miniature Pinscher, Affenpinscher, Brussels Griffon, Chinese Crested, Japanese Chin, Pekingese, Silky Terrier, Australian Cattle Dog, Collie, Cardigan Welsh Corgi, Old English Sheepdog, Puli, Pyrenean Shepherd, Swedish Vallhund, Finnish Lapphund, Icelandic Sheepdog, Entlebucher Mountain Dog, Dalmatian, Lhasa Apso, Tibetan Terrier, Tibetan Spaniel, Keeshond, Finnish Spitz, American Eskimo Dog, Schipperke, Shiba Inu, Basenji, Xoloitzcuintli, Pharaoh Hound, Ibizan Hound, Cirneco dell Etna, Norwegian Elkhound, Plott Hound, Treeing Walker Coonhound, Black and Tan Coonhound, Redbone Coonhound, American English Coonhound, Harrier, Otterhound, Norwegian Buhund, Berger Picard, Azawakh, Sloughi, Polish Lowland Sheepdog',
];

const BREED_SCHEMA = {
  name: 'breed_list',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      breeds: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            size: { type: 'string', enum: ['toy', 'small', 'medium', 'large', 'giant'] },
            energy: { type: 'string', enum: ['low', 'medium', 'high'] },
            shedding: { type: 'string', enum: ['low', 'medium', 'high'] },
            coat: { type: 'array', items: { type: 'string' } },
            temperament: { type: 'array', items: { type: 'string' } },
            group: { type: 'string' },
            good_with_kids: { type: 'boolean' },
            good_with_other_dogs: { type: 'boolean' },
            good_with_cats: { type: 'boolean' },
            trainability: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
            grooming: { type: 'string', enum: ['low', 'medium', 'high'] },
            lifespan_min: { type: 'integer' },
            lifespan_max: { type: 'integer' },
            cold_tolerance: { type: 'string', enum: ['low', 'medium', 'high'] },
            hot_tolerance: { type: 'string', enum: ['low', 'medium', 'high'] },
            barking: { type: 'string', enum: ['low', 'medium', 'high'] },
            rare: { type: 'boolean' },
          },
          required: ['name','slug','size','energy','shedding','coat','temperament','group','good_with_kids','good_with_other_dogs','good_with_cats','trainability','grooming','lifespan_min','lifespan_max','cold_tolerance','hot_tolerance','barking','rare'],
          additionalProperties: false,
        },
      },
    },
    required: ['breeds'],
    additionalProperties: false,
  },
};

async function generateBatch(breedNames, batchNum) {
  console.log(`\nGenerating batch ${batchNum}/3...`);
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 16000,
    messages: [
      {
        role: 'system',
        content: 'You are a dog breed expert. Generate accurate structured data for dog breeds. For slug: lowercase, hyphens only. For temperament: use keywords like affectionate, gentle, intelligent, loyal, protective, alert, independent, playful, calm, energetic, stubborn, friendly, quiet, courageous. Mark rare:true for breeds with low AKC registration numbers.',
      },
      {
        role: 'user',
        content: `Generate structured data for exactly these dog breeds:\n${breedNames}\n\nReturn data for every breed listed. Use accurate real-world characteristics.`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: BREED_SCHEMA },
    temperature: 0.1,
  });

  const result = JSON.parse(response.choices[0].message.content);
  console.log(`  ✓ ${result.breeds.length} breeds`);
  return result.breeds;
}

(async () => {
  const allBreeds = [];

  for (let i = 0; i < BREED_BATCHES.length; i++) {
    const batch = await generateBatch(BREED_BATCHES[i], i + 1);
    allBreeds.push(...batch);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Deduplicate by slug
  const seen = new Set();
  const unique = allBreeds.filter((b) => {
    if (seen.has(b.slug)) return false;
    seen.add(b.slug);
    return true;
  });

  const outDir = path.join(process.cwd(), 'content');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'breeds.json'),
    JSON.stringify(unique, null, 2)
  );
  console.log(`\nSaved ${unique.length} breeds to content/breeds.json`);
})();
