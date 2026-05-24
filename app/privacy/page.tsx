export const metadata = {
  title: "Privacy Policy",
};

export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 prose prose-stone">
      <h1>Privacy Policy</h1>
      <p className="text-stone-500 italic">
        Generate your Privacy Policy at{" "}
        <strong>termly.io</strong> (free). Select &ldquo;Ad-supported blog&rdquo;,
        add Adsterra and Google AdSense as data processors, then paste the
        generated content here to replace this placeholder.
      </p>
      <p>
        This site is operated by Value Finds Daily. We use third-party
        advertising networks including Adsterra which may use cookies to serve
        ads based on your prior visits. You can opt out of personalized
        advertising by visiting{" "}
        <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer">
          aboutads.info
        </a>
        .
      </p>
    </main>
  );
}
