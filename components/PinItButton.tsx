// "Save to Pinterest" link. Plain anchor to Pinterest's pin-create endpoint —
// no third-party script, works on every page, and every reader who saves a
// guide or product sends Pinterest the save signal the account is missing.
export default function PinItButton({
  url,
  media,
  description,
  className = "",
}: {
  url: string;
  media: string;
  description: string;
  className?: string;
}) {
  const href =
    "https://www.pinterest.com/pin/create/button/?" +
    new URLSearchParams({ url, media, description }).toString();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full bg-[#e60023] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#c8001f] ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 5.1 3.2 9.4 7.6 11.1-.1-.9-.2-2.4 0-3.4l1.4-6s-.4-.7-.4-1.8c0-1.7 1-2.9 2.2-2.9 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3l-.3 1.4c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.6 0-3.8 2.7-7.2 7.9-7.2 4.1 0 7.4 3 7.4 6.9 0 4.1-2.6 7.4-6.2 7.4-1.2 0-2.4-.6-2.8-1.4l-.7 2.9c-.3 1-1 2.3-1.5 3.1 1.1.3 2.3.5 3.5.5 6.6 0 12-5.4 12-12S18.6 0 12 0z" />
      </svg>
      Save to Pinterest
    </a>
  );
}
