"use client";

type Props = {
  href: string;
  useDirectLink: boolean;
  isLastSlide: boolean;
  nextRank: number;
  hasNext: boolean;
  directLink?: string;
};

export default function NextButton({
  href,
  useDirectLink,
  isLastSlide,
  nextRank,
  hasNext,
  directLink,
}: Props) {
  if (!hasNext) return null;

  const handleClick = () => {
    if (useDirectLink && directLink) {
      window.open(directLink, "_blank");
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="flex-1 block text-center bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-4 rounded-full font-semibold text-lg"
    >
      {isLastSlide ? "See full ranking" : `Next: #${nextRank} →`}
    </a>
  );
}
