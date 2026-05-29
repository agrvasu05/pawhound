import Link from "next/link";

type Props = {
  href: string;
  isLastSlide: boolean;
  nextRank: number;
  hasNext: boolean;
};

export default function NextButton({
  href,
  isLastSlide,
  nextRank,
  hasNext,
}: Props) {
  if (!hasNext) return null;

  return (
    <Link
      href={href}
      className="flex-1 block text-center bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-4 rounded-full font-semibold text-lg"
    >
      {isLastSlide ? "See full ranking" : `Next: #${nextRank} →`}
    </Link>
  );
}
