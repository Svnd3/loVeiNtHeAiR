// Thin wrapper around the Resend API, shared by every function that sends a
// notification email. Never throws -- a failed email should never take down
// the surprise-creation / view-tracking / payment flow that triggered it, so
// callers just fire-and-forget this and move on.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");

  if (!apiKey || !from) {
    console.error("Resend is not configured (missing RESEND_API_KEY or RESEND_FROM_EMAIL)");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      console.error("Resend send failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("Resend send threw", error);
  }
}

// Business-inbox copy for events the site owner should know about without
// digging through the Supabase/Paystack dashboards (new signup, new payment).
// Defaults to loveinntheairr@gmail.com but stays overridable via ADMIN_EMAIL
// in case that inbox ever changes.
export async function sendAdminEmail({
  subject,
  html,
}: {
  subject: string;
  html: string;
}) {
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "loveinntheairr@gmail.com";
  await sendEmail({ to: adminEmail, subject, html });
}
