import { useSmartBack } from '../lib/useSmartBack'
import './Terms.css'

const EFFECTIVE_DATE = '25 July 2026'

function Terms() {
  const goBack = useSmartBack('/')

  return (
    <main className="terms-page">
      <button
        type="button"
        className="terms-page__back"
        onClick={goBack}
        aria-label="Go back"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="terms-doc">
        <h1>Terms &amp; Privacy Policy</h1>
        <p className="terms-doc__meta">Effective {EFFECTIVE_DATE}</p>

        <p>
          LoVe In tHe aIR ("the Service", "we", "us") lets someone (the "Creator", "you") build a
          personalized page — photos, a letter, a song, a small gift reveal — for another person
          (the "Recipient") and share it with them as a private link. These terms explain what
          that means for both of you. The Privacy Policy is the second half of this page.
        </p>

        <nav className="terms-doc__toc" aria-label="Sections">
          <a href="#terms">Terms of Service</a>
          <a href="#privacy">Privacy Policy</a>
        </nav>

        <section id="terms">
          <h2>Terms of Service</h2>

          <h3>1. Accepting these terms</h3>
          <p>
            By creating an account you confirm you're at least 18 years old and agree to these
            terms. If you don't agree, don't create an account.
          </p>

          <h3>2. What the Service does</h3>
          <p>
            You give us photos, names, a written letter, and optionally a gift description and a
            song. We turn that into a page at a private, hard-to-guess link and let you send that
            link to your Recipient. She does not need an account to open it.
          </p>

          <h3>3. Your account</h3>
          <p>
            You're responsible for keeping your login credentials secure and for everything that
            happens under your account. Tell us if you think someone else has access to it.
          </p>

          <h3>4. Content you upload</h3>
          <p>
            You keep ownership of the photos, text, and files you upload. By uploading them, you
            give us permission to store, process, and display that content back to you and to
            anyone you share your link with — that's the whole point of the Service.
          </p>
          <p>You promise that:</p>
          <ul>
            <li>
              You have the right to upload and share every photo you use — including photos of
              your Recipient, who is very unlikely to have agreed to this herself. You're
              responsible for making sure she'd be okay with her name, nickname, and photos
              appearing on a page you're sending her.
            </li>
            <li>
              Nothing you upload is illegal, harassing, non-consensual, or infringes someone
              else's rights.
            </li>
            <li>You won't use the Service to build a page for someone without a legitimate, good-faith intent to share it with that person.</li>
          </ul>
          <p>
            We can remove content or suspend an account that breaks these rules, with or without
            notice.
          </p>

          <h3>5. The link you send her</h3>
          <p>
            The share link isn't listed anywhere and isn't guessable, but anyone who has the exact
            link can open the page — we have no way to check who's viewing it. Only send it to the
            person it's meant for. We're not responsible if you share it more widely, or if she
            forwards it on.
          </p>

          <h3>6. Music &amp; lyrics</h3>
          <p>
            The Service includes a library of songs you can pick for your page, and can display
            lyrics alongside them. Those recordings, compositions, and lyrics belong to their
            original artists, writers, and labels — we don't claim any ownership over them, and
            they're included for personal, non-commercial use within your page only. If you upload
            your own audio file, you confirm you have the right to use it this way. If you're a
            rights holder and want something removed, contact us at{' '}
            <a href="mailto:loveinntheairr@gmail.com">loveinntheairr@gmail.com</a> and we'll act on valid requests
            promptly.
          </p>

          <h3>7. Paid features &amp; billing</h3>
          <p>
            Building a page is free. Getting the link to send your Recipient requires a one-time
            payment of KSh 299, which unlocks everything — your own uploaded song, the gift
            attachment, unlimited questions, and every other feature the Service offers. Payments
            are processed by Paystack; we never see or store your card or mobile money details
            ourselves.
          </p>
          <p>
            Each payment unlocks one page for one Recipient. There's no subscription and nothing
            renews or charges again automatically.
          </p>

          <h3>8. Refunds</h3>
          <p>
            Because payment unlocks something typically opened within minutes of you sending the
            link, refunds work like this:
          </p>
          <ul>
            <li>
              If your payment succeeds but the Service fails to deliver a working page — for
              example, the link never becomes accessible because of a fault on our end — email us
              within 7 days and we'll fix it or refund you in full.
            </li>
            <li>
              If you change your mind before sending the link to your Recipient, contact us within
              24 hours of payment and we'll refund you, as long as the link hasn't been opened yet.
            </li>
            <li>
              Once your Recipient has opened the link, we consider the surprise delivered, and it's
              no longer eligible for a refund.
            </li>
          </ul>
          <p>
            To request a refund, email{' '}
            <a href="mailto:loveinntheairr@gmail.com">loveinntheairr@gmail.com</a> with your
            account email and the surprise's link. If you dispute a charge directly with Paystack
            or your bank instead, that's handled by their own process — contacting us first is
            usually faster.
          </p>

          <h3>9. Suspension &amp; termination</h3>
          <p>
            You can stop using the Service and ask us to delete your account at any time (see the
            Privacy Policy for how). We can suspend or terminate accounts that violate these terms,
            attempt to abuse or overload the Service, or use it for anything illegal.
          </p>

          <h3>10. No warranty</h3>
          <p>
            We built this to make a nice moment happen, not as mission-critical infrastructure. The
            Service is provided "as is" — we don't guarantee it will be uninterrupted, error-free,
            or available forever, and we make no promises about the accuracy of song lyrics we
            display (they're sourced from third parties and may sometimes be wrong or out of sync).
          </p>

          <h3>11. Limitation of liability</h3>
          <p>
            To the extent allowed by law, we're not liable for indirect, incidental, or
            consequential damages arising from your use of the Service — including a surprise not
            landing the way you hoped. Our total liability for any claim relating to the Service is
            limited to the amount you paid us in the twelve months before the claim (which, for
            most users, is nothing).
          </p>

          <h3>12. You indemnify us</h3>
          <p>
            If a claim arises because of content you uploaded (including a photo, name, or detail
            about your Recipient, or a song you uploaded), you agree to cover the reasonable costs
            and damages that come from that claim.
          </p>

          <h3>13. Governing law</h3>
          <p>
            These terms are governed by the laws of Kenya, without regard to conflict-of-law
            rules. Any dispute arising from these terms or your use of the Service is subject to
            the exclusive jurisdiction of the courts of Kenya.
          </p>

          <h3>14. Changes to these terms</h3>
          <p>
            We may update these terms as the Service changes. If we make a material change, we'll
            update the effective date above and, where practical, let existing users know.
          </p>

          <h3>15. Contact</h3>
          <p>
            Questions about these terms:{' '}
            <a href="mailto:loveinntheairr@gmail.com">loveinntheairr@gmail.com</a>
          </p>
        </section>

        <section id="privacy">
          <h2>Privacy Policy</h2>

          <h3>1. What we collect</h3>
          <ul>
            <li>Your email address and password (or Google account info, if you sign in that way).</li>
            <li>
              Profile details you enter: your name and country, and your Recipient's name,
              nickname, and country.
            </li>
            <li>Photos you upload of yourself and your Recipient.</li>
            <li>The letter you write, and any gift details or message you add.</li>
            <li>The song you pick from our library, or an audio file you upload.</li>
            <li>A small amount of technical data (like cookies) needed to keep you signed in.</li>
          </ul>

          <h3>2. How we use it</h3>
          <p>
            Only to build and serve your page at your unique share link, keep you signed in, and
            let you come back and edit it later. We don't sell your data, and we don't use your
            photos or letters for advertising.
          </p>

          <h3>3. Where it's stored</h3>
          <p>
            The Service is operated from Kenya. We use Supabase to host our database and file
            storage, and Google to offer sign-in-with-Google — these providers may process data
            outside Kenya. Photos and any uploaded songs are stored in a storage bucket that is
            reachable by anyone with the exact file link — the same "unguessable link" model as
            the surprise page itself. We don't index it publicly or make it searchable.
          </p>

          <h3>4. Cookies</h3>
          <p>
            We use a small amount of local storage / cookies purely to keep you signed in and to
            remember that you've dismissed the cookie notice. We don't use tracking or advertising
            cookies.
          </p>

          <h3>5. About your Recipient's data</h3>
          <p>
            Your Recipient doesn't create an account and doesn't give us her data directly — you
            provide it on her behalf when you build her page. That means you're responsible for
            making sure you have a reasonable basis (her consent, or an existing relationship where
            this is expected) to share her name, nickname, and photos with us this way. If someone
            contacts us asking us to remove a page that features them, we will take it down.
          </p>

          <h3>6. How long we keep it</h3>
          <p>
            We keep your account and page data until you ask us to delete it. There's no self-serve
            delete button yet — email <a href="mailto:loveinntheairr@gmail.com">loveinntheairr@gmail.com</a> from your
            account's email address and we'll delete your account, your page(s), and associated
            files.
          </p>

          <h3>7. Children</h3>
          <p>The Service is intended for people 18 and over and isn't directed at children.</p>

          <h3>8. Your rights</h3>
          <p>
            You can ask us what data we hold about you, ask us to correct it, or ask us to delete
            it, by emailing <a href="mailto:loveinntheairr@gmail.com">loveinntheairr@gmail.com</a>. If
            you're in Kenya, you have rights under the Data Protection Act, 2019 — including the
            right to access, correct, object to processing of, and request deletion of your
            personal data, and the right to lodge a complaint with the Office of the Data
            Protection Commissioner (ODPC) if you think we've mishandled it. If you're in another
            region with statutory data rights (like the EU/UK GDPR or California's CCPA), those
            rights apply on top of what's described here.
          </p>

          <h3>9. Security</h3>
          <p>
            We use reasonable technical measures (encrypted connections, access-controlled storage)
            to protect your data, but no online service can guarantee perfect security.
          </p>

          <h3>10. Changes to this policy</h3>
          <p>
            If we materially change how we handle your data, we'll update the effective date above
            and, where practical, let existing users know.
          </p>

          <h3>11. Contact</h3>
          <p>
            Privacy questions: <a href="mailto:loveinntheairr@gmail.com">loveinntheairr@gmail.com</a>
          </p>
        </section>
      </div>
    </main>
  )
}

export default Terms
