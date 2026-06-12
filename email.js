const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "onboarding@resend.dev";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "suyashpatel76@gmail.com";

// ─────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────

const base = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Elite Run Club</title>
</head>
<body style="margin:0;padding:0;background:#EDEBE7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEBE7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="background:#2B4A8C;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.6);">Elite Run Club</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);font-style:italic;">Don't scroll your life away. Run it instead.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#999;">© 2025 Elite Run Club, Lucknow · <a href="#" style="color:#2B4A8C;text-decoration:none;">Unsubscribe</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const btn = (text, href) =>
  `<a href="${href}" style="display:inline-block;background:#2B4A8C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:15px;font-weight:600;margin-top:8px;">${text}</a>`;

const divider = () =>
  `<hr style="border:none;border-top:1px solid #eee;margin:28px 0;"/>`;

const tag = (text) =>
  `<span style="display:inline-block;background:#e8edf7;color:#2B4A8C;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:20px;">${text}</span>`;

// ─────────────────────────────────────────────
// 1. RSVP confirmation → runner
// ─────────────────────────────────────────────

async function sendRsvpConfirmation({ name, email, event }) {
  const eventDate = new Date(event.date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = base(`
    ${tag("You're registered")}
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1a1a1a;">See you at the run, ${name.split(" ")[0]}!</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.6;">Your spot is confirmed for <strong style="color:#2B4A8C;">${event.title}</strong>. Here are the details:</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fc;border-radius:12px;padding:24px;margin-bottom:28px;">
      <tr>
        <td style="padding:8px 0;">
          <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Date</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${eventDate}</p>
        </td>
      </tr>
      <tr><td style="padding:8px 0;">
          <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Time</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${event.time}</p>
      </td></tr>
      <tr><td style="padding:8px 0;">
          <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Location</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${event.location}</p>
      </td></tr>
      ${event.distance_km ? `<tr><td style="padding:8px 0;">
          <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Distance</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${event.distance_km} km · ${event.difficulty}</p>
      </td></tr>` : ""}
    </table>

    <p style="font-size:14px;color:#666;line-height:1.6;margin-bottom:28px;">
      Arrive 10–15 minutes early for a warm-up. Wear comfortable running shoes and bring water. Can't make it? Just let us know so we can free up your spot.
    </p>

    ${btn("View Event Details", `${process.env.BASE_URL || "http://localhost:3000"}/events`)}

    ${divider()}
    <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">Questions? Reply to this email or DM us on Instagram.</p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `You're in — ${event.title} on ${eventDate} ✅`,
    html,
  });
}

// ─────────────────────────────────────────────
// 2. Welcome email → new member
// ─────────────────────────────────────────────

async function sendWelcomeEmail({ name, email }) {
  const html = base(`
    ${tag("Welcome to the club")}
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1a1a1a;">Hey ${name.split(" ")[0]}, let's run. 👟</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.6;">
      You've joined <strong style="color:#2B4A8C;">Elite Run Club</strong> — Lucknow's fastest-growing youth running community. We started with 6 runners in September 2024 and now show up every week, rain or shine.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="40" valign="top" style="padding-top:2px;">
          <div style="width:32px;height:32px;background:#e8edf7;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">🏃</div>
        </td>
        <td style="padding-left:14px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">Weekly Club Runs</p>
          <p style="margin:4px 0 0;font-size:14px;color:#666;">We run every week across Lucknow. Check the events page to RSVP for the next one.</p>
        </td>
      </tr>
      <tr><td height="16"></td></tr>
      <tr>
        <td width="40" valign="top" style="padding-top:2px;">
          <div style="width:32px;height:32px;background:#e8edf7;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">🗺️</div>
        </td>
        <td style="padding-left:14px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">Local Routes</p>
          <p style="margin:4px 0 0;font-size:14px;color:#666;">From Gomti Riverfront to Janeshwar Park — explore curated routes built by the community.</p>
        </td>
      </tr>
      <tr><td height="16"></td></tr>
      <tr>
        <td width="40" valign="top" style="padding-top:2px;">
          <div style="width:32px;height:32px;background:#e8edf7;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">🤝</div>
        </td>
        <td style="padding-left:14px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">Community Drives</p>
          <p style="margin:4px 0 0;font-size:14px;color:#666;">We don't just run — we show up for Lucknow. Food drives, school visits, community bhandaras.</p>
        </td>
      </tr>
    </table>

    ${btn("See Upcoming Runs", `${process.env.BASE_URL || "http://localhost:3000"}/events`)}

    ${divider()}
    <p style="margin:0;font-size:14px;color:#888;line-height:1.6;text-align:center;">
      <em>Don't scroll your life away. Run it instead.</em>
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Welcome to Elite Run Club, ${name.split(" ")[0]}! 🏃`,
    html,
  });
}

// ─────────────────────────────────────────────
// 3. New route submission alert → admin
// ─────────────────────────────────────────────

async function sendRouteSubmissionAlert({ route }) {
  const html = base(`
    ${tag("New Route Submission")}
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">A new route needs review</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;">Someone just submitted a community route. Review it and approve or reject from the admin panel.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fc;border-radius:12px;padding:24px;margin-bottom:28px;">
      <tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Route Name</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${route.name}</p>
      </td></tr>
      <tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Distance</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${route.distance_miles ? `${route.distance_miles} miles` : "Not specified"}</p>
      </td></tr>
      <tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Difficulty</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${route.difficulty}</p>
      </td></tr>
      ${route.description ? `<tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Description</p>
        <p style="margin:4px 0 0;font-size:15px;color:#444;line-height:1.6;">${route.description}</p>
      </td></tr>` : ""}
      ${route.submitted_by ? `<tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Submitted By</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">${route.submitted_by}</p>
      </td></tr>` : ""}
    </table>

    ${btn("Review Routes", `${process.env.BASE_URL || "http://localhost:3000"}/admin/routes`)}
  `);

  return resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New route submitted: "${route.name}"`,
    html,
  });
}

// ─────────────────────────────────────────────
// Shared error wrapper — emails never crash the server
// ─────────────────────────────────────────────

async function send(fn, label) {
  try {
    const result = await fn();
    console.log(`[email] ${label} sent →`, result?.data?.id || "ok");
  } catch (err) {
    console.error(`[email] ${label} failed:`, err.message);
  }
}

module.exports = {
  sendRsvpConfirmation: (data) =>
    send(() => sendRsvpConfirmation(data), `RSVP confirmation to ${data.email}`),
  sendWelcomeEmail: (data) =>
    send(() => sendWelcomeEmail(data), `Welcome email to ${data.email}`),
  sendRouteSubmissionAlert: (data) =>
    send(() => sendRouteSubmissionAlert(data), `Route alert for "${data.route.name}"`),
};