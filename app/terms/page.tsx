export const metadata = {
  title: "Terms of Service",
  description:
    "The terms of service for using valuefindsdaily.com, including content usage, affiliate disclosure, and liability limits.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 prose prose-stone">
      <h1>Terms of Service</h1>
      <p className="text-stone-500 text-sm">Last updated: May 25, 2025</p>

      <p>
        By accessing or using Value Finds Daily (valuefindsdaily.com), you agree
        to be bound by these Terms of Service. If you do not agree, please do not
        use this site.
      </p>

      <h2>Use of Content</h2>
      <p>
        All content on this site — including articles, breed descriptions, images,
        and rankings — is provided for informational and entertainment purposes
        only. Content may not be reproduced, republished, or redistributed without
        our written permission.
      </p>

      <h2>No Professional Advice</h2>
      <p>
        Nothing on this site constitutes professional veterinary, training, or
        animal behavior advice. Breed information is general in nature. Always
        consult a qualified veterinarian or certified trainer before acquiring or
        making decisions about a dog.
      </p>

      <h2>Advertising</h2>
      <p>
        This site displays third-party advertisements. We are not responsible for
        the content of those ads or for any products or services advertised. Clicks
        on ads may result in you leaving this site.
      </p>

      <h2>Disclaimer of Warranties</h2>
      <p>
        This site is provided &ldquo;as is&rdquo; without any warranties of any kind.
        We do not guarantee the accuracy, completeness, or suitability of any
        information on this site.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        Value Finds Daily shall not be liable for any direct, indirect, incidental,
        or consequential damages arising from your use of this site or reliance on
        any content herein.
      </p>

      <h2>Changes to Terms</h2>
      <p>
        We may update these Terms at any time. Continued use of the site after
        changes constitutes acceptance of the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about these Terms, visit our <a href="/contact">contact page</a>.
      </p>
    </main>
  );
}
