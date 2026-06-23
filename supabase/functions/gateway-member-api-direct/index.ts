import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import CryptoJS from "npm:crypto-js@4.2.0";
import {
  isValidSubmissionId,
  loadSubmission,
  markSubmissionGatewayFailure,
  markSubmissionGatewaySuccess,
} from "../_shared/enrollmentSubmissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Cache-Control, X-Submission-Id",
};

/** Detect downstream success from enrollment123, tolerating string/boolean SUCCESS. */
function parseGatewaySuccess(responseData: unknown, httpOk: boolean): boolean {
  let bodySuccess = httpOk;
  if (httpOk && responseData && typeof responseData === "object") {
    const root = responseData as Record<string, unknown>;
    const tx = root.TRANSACTION as Record<string, unknown> | undefined;
    const txVal = (tx?.SUCCESS ?? root.SUCCESS) as unknown;
    if (typeof txVal !== "undefined") {
      const isTrue =
        txVal === true ||
        txVal === "true" ||
        (typeof txVal === "string" && txVal.toLowerCase() === "true");
      const isFalse =
        txVal === false ||
        txVal === "false" ||
        (typeof txVal === "string" && txVal.toLowerCase() === "false");
      if (isFalse) bodySuccess = false;
      else if (isTrue) bodySuccess = true;
    }
  }
  return bodySuccess;
}

function decryptPassword(encryptedPassword: string): string {
  try {
    const secretKey = Deno.env.get("VITE_ENCRYPTION_SECRET_KEY");
    if (!secretKey) {
      throw new Error("Encryption secret key not configured");
    }
    const decrypted = CryptoJS.AES.decrypt(encryptedPassword, secretKey);
    const originalPassword = decrypted.toString(CryptoJS.enc.Utf8);
    if (!originalPassword) {
      throw new Error("Decryption resulted in empty string");
    }
    return originalPassword;
  } catch (error) {
    throw new Error("Failed to decrypt password");
  }
}

interface GatewayRequest {
  memberId?: string;
  pdfUrl?: string;
  customerEmail?: string;
  submissionId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, status: 405, error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const agentIdParam = url.searchParams.get('id');
    const agentNumber = agentIdParam ? parseInt(agentIdParam) : 768413;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, status: 500, error: "Database configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: advisorData, error: advisorError } = await supabase
      .from('advisor')
      .select('username, password')
      .eq('sales_id', agentNumber)
      .maybeSingle();

    if (advisorError) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 500,
          error: "Failed to retrieve advisor credentials",
          details: advisorError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!advisorData) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 404,
          error: `Advisor not found for agent number: ${agentNumber}`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!advisorData.username || !advisorData.password) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 500,
          error: "API credentials not configured for this advisor"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const username = advisorData.username;
    let password: string;

    try {
      password = decryptPassword(advisorData.password);
    } catch (decryptError) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 500,
          error: "Failed to decrypt advisor credentials"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const requestData: GatewayRequest = await req.json();

    const trimmedMemberId = (requestData.memberId ?? '').toString().trim();
    const hasPdfUrl = !!(requestData.pdfUrl && requestData.pdfUrl.trim().length > 0);

    const submissionId = isValidSubmissionId(requestData.submissionId)
      ? requestData.submissionId!.trim()
      : null;

    // If this submission's PDF was already attached/completed, replay success
    // instead of attaching the document a second time.
    if (submissionId) {
      const existing = await loadSubmission(supabase, submissionId);
      if (existing && ['pdf_attached', 'completed'].includes(existing.status)) {
        return new Response(
          JSON.stringify({ success: true, status: 200, data: { idempotentReplay: true } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const formData = new URLSearchParams();
    formData.append("CORP_ID", "1402");
    formData.append("API_USERNAME", username);
    formData.append("API_PASSWORD", password);
    formData.append("AGENT_ID", agentNumber.toString());

    if (hasPdfUrl) {
      formData.append("DOC_TYPE", "Signature");
      formData.append("DOC_DESCRIPTION", "Signature");
      formData.append("DOC_PROCESSOR", "Internal");
      formData.append("DOC_FILEURL", requestData.pdfUrl!);
      /** Only attach when present — enrollment123 falls back to the agent's most recent member otherwise. */
      if (trimmedMemberId) {
        formData.append("MEMBER_ID", trimmedMemberId);
      }
    }

    const gatewayApiUrl = "https://enrollment123.com/gateway/member.cfm";

    const response = await fetch(gatewayApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    const bodySuccess = parseGatewaySuccess(responseData, response.ok);

    /**
     * PDFs are retained in `enrollment-documents` storage as a permanent record
     * of the enrollment; do not delete after the gateway call succeeds.
     */

    // Update submission status so the background retry cron can finish (or
    // skip) this row. A confirmed attach completes it; a failure increments the
    // attempt counter for a later retry.
    if (submissionId) {
      if (bodySuccess) {
        await markSubmissionGatewaySuccess(supabase, submissionId);
      } else {
        const row = await loadSubmission(supabase, submissionId);
        await markSubmissionGatewayFailure(
          supabase,
          submissionId,
          typeof responseData === "string" ? responseData : JSON.stringify(responseData),
          row?.gateway_attempts ?? 0,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: bodySuccess,
        status: response.status,
        data: responseData,
      }),
      {
        status: bodySuccess ? 200 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        status: 500,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
