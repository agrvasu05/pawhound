export const metadata = {
  title: "Contact",
  description:
    "Questions, corrections, or partnership inquiries — how to reach the Value Finds Daily editorial team.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 prose prose-stone">
      <h1>Contact Value Finds Daily</h1>
      <p>
        For questions, corrections, or partnership inquiries, email us at:
      </p>
      <p>
        <a href="mailto:hello@valuefindsdaily.com">
          hello@valuefindsdaily.com
        </a>
      </p>
      <p>We typically respond within 2–3 business days.</p>
    </main>
  );
}
