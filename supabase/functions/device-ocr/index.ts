import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 인증 확인: 로그인된 사용자만 호출 가능 (AI 크레딧 남용 방지)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // 크기 제한: 약 ~3.75MB 디코딩 분량 (base64 ~5M chars)
    const MAX_B64_CHARS = 5_000_000;
    if (imageBase64.length > MAX_B64_CHARS) {
      return new Response(
        JSON.stringify({ error: "이미지 크기 초과 (최대 ~3.75MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "당신은 휴대폰 단말기 라벨/박스/IMEI 스티커 사진을 분석하는 전문가입니다. 한국어 모델명, IMEI/일련번호, 색상, 용량을 정확히 추출하세요.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 이미지에서 단말기 정보를 추출해줘. 모델명(예: 갤럭시 S24 울트라, 아이폰 15 Pro), 일련번호/IMEI(15자리 숫자), 색상, 용량(GB/TB)을 찾아줘. 여러 단말기가 있으면 모두 추출해.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_devices",
              description: "이미지에서 추출한 단말기 목록을 반환",
              parameters: {
                type: "object",
                properties: {
                  devices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        model: { type: "string", description: "단말기 모델명" },
                        serial_no: { type: "string", description: "IMEI/일련번호" },
                        color: { type: "string", description: "색상" },
                        capacity: { type: "string", description: "저장용량 (예: 256GB)" },
                      },
                      required: ["model"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["devices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_devices" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (resp.status === 402)
        return new Response(JSON.stringify({ error: "AI 사용량을 초과했습니다. 워크스페이스에서 크레딧을 충전하세요." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: "AI 처리 실패" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let devices: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        devices = JSON.parse(toolCall.function.arguments).devices ?? [];
      } catch (e) {
        console.error("parse error", e);
      }
    }

    return new Response(JSON.stringify({ devices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("device-ocr error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
