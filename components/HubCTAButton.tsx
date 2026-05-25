"use client";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  directLink?: string;
};

export default function HubCTAButton({
  href,
  children,
  className,
  directLink,
}: Props) {
  const handleClick = () => {
    if (directLink) {
      window.open(directLink, "_blank");
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
