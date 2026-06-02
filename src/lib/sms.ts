export async function sendSMSOTP(to: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn("[SMS] Twilio not configured — skipping SMS. OTP:", code);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

  const body = new URLSearchParams({
    From: from,
    To: to,
    Body: `Your Parkkal verification code: ${code}. Valid for 15 minutes. Do not share this with anyone.`,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[SMS] Failed to send OTP SMS:", err);
    throw new Error(`SMS send failed: ${res.status}`);
  }
}
