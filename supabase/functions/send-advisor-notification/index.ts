import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Cache-Control",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface NotificationRequest {
  salesId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  planName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: NotificationRequest = await req.json();
    const { salesId, planName } = payload;
    const customerFirstName = (payload.customerFirstName || "").trim().slice(0, 100);
    const customerLastName = (payload.customerLastName || "").trim().slice(0, 100);
    const customerEmail = (payload.customerEmail || "").trim().slice(0, 254);

    if (!salesId) {
      return new Response(
        JSON.stringify({ success: false, error: "salesId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: advisor, error: advisorError } = await supabase
      .from("advisor")
      .select("email, advisor_name, fname")
      .eq("sales_id", parseInt(salesId, 10))
      .maybeSingle();

    if (advisorError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch advisor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!advisor || !advisor.email) {
      return new Response(
        JSON.stringify({ success: true, message: "No advisor found, skipping email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const enrollmentDate = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const advisorFirstName = advisor.fname || advisor.advisor_name?.split(" ")[0] || "Advisor";
    const formName = planName || "Direct Enrollment";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">New Enrollment Notification</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${advisorFirstName},
              </p>
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                Great news! A new member has successfully enrolled through your referral link.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">Member Name</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                          <span style="color: #1e293b; font-size: 14px; font-weight: 500;">${customerFirstName} ${customerLastName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">Email</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                          <span style="color: #1e293b; font-size: 14px; font-weight: 500;">${customerEmail}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">Plan</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                          <span style="color: #1e293b; font-size: 14px; font-weight: 500;">${formName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 14px;">Enrolled On</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #1e293b; font-size: 14px; font-weight: 500;">${enrollmentDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Thank you for your continued partnership with MPB Health.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                MPB Health &bull; This is an automated notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MPB Health <system@mpb.health>",
        to: [advisor.email],
        subject: "New Enrollment Notification",
        html: emailHtml,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email", details: resendResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Advisor notification sent", emailId: resendResult.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
