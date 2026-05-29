import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function HubCTAButton({ href, children, className }: Props) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
