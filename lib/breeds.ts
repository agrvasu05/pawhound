import breedsJson from "@/content/breeds.json";

export type Breed = {
  name: string;
  slug: string;
  size: string;
  energy: string;
  shedding: string;
  grooming: string;
  trainability: string;
  barking: string;
  lifespan_min: number;
  lifespan_max: number;
  good_with_kids: boolean;
  good_with_cats: boolean;
  good_with_other_dogs: boolean;
  group?: string;
};

const BY_NAME = new Map<string, Breed>(
  (breedsJson as Breed[]).map((b) => [b.name.toLowerCase(), b])
);

export function getBreed(name: string): Breed | null {
  return BY_NAME.get(name.toLowerCase()) ?? null;
}
