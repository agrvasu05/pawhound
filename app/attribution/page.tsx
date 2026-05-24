import fs from "fs";
import path from "path";

export const metadata = { title: "Image Credits" };

export default function Attribution() {
  const breedsDir = path.join(process.cwd(), "public", "images", "breeds");
  const credits: { breed: string; photographers: string[] }[] = [];

  if (fs.existsSync(breedsDir)) {
    for (const breed of fs.readdirSync(breedsDir)) {
      const attFile = path.join(breedsDir, breed, "attribution.json");
      if (fs.existsSync(attFile)) {
        const data = JSON.parse(fs.readFileSync(attFile, "utf-8"));
        credits.push({
          breed: breed.replace(/-/g, " "),
          photographers: data.map((d: { photographer: string }) => d.photographer),
        });
      }
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 prose prose-stone">
      <h1>Image Credits</h1>
      <p>
        All photography on Value Finds Daily is licensed from Unsplash and
        Pexels. We&apos;re grateful to the photographers below for sharing their
        work.
      </p>
      {credits.length === 0 ? (
        <p className="text-stone-400 italic">
          Credits will appear here once breed images are downloaded.
        </p>
      ) : (
        <ul>
          {credits.map((c) => (
            <li key={c.breed}>
              <strong className="capitalize">{c.breed}</strong>:{" "}
              {c.photographers.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
