export const metadata = {
  title: "About Value Finds Daily",
  description: "About Value Finds Daily.",
};

export default function About() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 prose prose-stone">
      <h1>About Value Finds Daily</h1>
      <p>
        Value Finds Daily exists because picking a dog is one of the bigger
        decisions a household makes, and most of the information out there is
        shallow, contradictory, or written to sell you something.
      </p>
      <p>
        We&apos;re a small team of dog enthusiasts who research breeds from
        primary sources: kennel club standards, breed-club histories, and
        veterinary literature. We don&apos;t accept paid placement in our
        rankings.
      </p>
      <p>
        We aim to help you find the breed that fits your actual life — not the
        one that&apos;s trending on social media or being pushed by a breeder.
      </p>
      <p>
        Have a question or feedback? Email{" "}
        <a href="mailto:hello@valuefindsdaily.com">hello@valuefindsdaily.com</a>
        .
      </p>
    </main>
  );
}
