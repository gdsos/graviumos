import { createClient } from "npm:@supabase/supabase-js@2.104.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushRequestBody {
  userId?: string;
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@gravium.in";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({
        error: "Push notification server is not configured.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const body = (await request.json()) as PushRequestBody;

  if (!body.userId) {
    return new Response(JSON.stringify({ error: "Missing userId." }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: subscriptions, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("user_id", body.userId);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: 0,
        removed: 0,
        message: "No push subscriptions found for user.",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: body.title || "Gravium OS",
    body: body.body || "You have a new notification.",
    icon: body.icon || "/icons/icon-192.png",
    badge: body.badge || "/icons/notification-badge-96.png",
    url: body.url || "/portal/overview",
  });

  let sent = 0;
  let removed = 0;
  const failures: Array<{ id: string; message: string }> = [];

  await Promise.all(
    subscriptions.map(async subscriptionRow => {
      try {
        await webpush.sendNotification(subscriptionRow.subscription, payload);
        sent += 1;
      } catch (error) {
        const pushError = error as {
          message?: string;
          statusCode?: number;
          body?: string;
          headers?: Record<string, string>;
        };

        const message = pushError.message || String(error);
        const statusCode = pushError.statusCode;
        const responseBody = pushError.body || "";

        failures.push({
          id: subscriptionRow.id,
          message,
          statusCode,
          body: responseBody,
        });

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", subscriptionRow.id);

          removed += 1;
        }
      }
    }),
  );

  return new Response(
    JSON.stringify({
      ok: true,
      sent,
      removed,
      failures,
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
});
