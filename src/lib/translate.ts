import { GoogleGenAI } from "@google/genai";
import { secret } from "./settings";

/**
 * Vietnamese → English for engines that need it.
 *
 * Nano Banana follows Vietnamese directly (verified live), so this only runs for
 * the FLUX family. The translation is deliberately literal and domain-aware: a
 * fluent paraphrase is worse here, because "dải phân cách" becoming "road
 * divider" instead of "central median barrier" changes what gets rendered.
 *
 * Server-only.
 */

const MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.1-flash-lite";

const SYSTEM = [
  "You translate short image-editing instructions from Vietnamese to English.",
  "The domain is civil engineering visualisation: roads, railways, bridges, tunnels.",
  "Rules:",
  "- Output the English translation only. No preamble, no quotes, no explanation.",
  "- Keep it literal. Do not add detail the original does not state.",
  "- Use the standard civil-engineering term, not a everyday paraphrase:",
  "  dải phân cách = central median barrier; làn xe = traffic lane;",
  "  lan can = parapet/railing; trụ cầu = bridge pier; mố cầu = abutment;",
  "  dầm = girder; mặt đường = carriageway/pavement surface;",
  "  taluy = cut slope; rãnh dọc = longitudinal drainage channel;",
  "  cột tiếp xúc = catenary mast; tà vẹt = sleeper; đá ba lát = ballast.",
  "- If the input is already English, return it unchanged.",
].join("\n");

/** Cheap guard so an already-English instruction never costs a call. */
function looksVietnamese(text: string): boolean {
  return /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(
    text,
  );
}

export async function translateToEnglish(instruction: string): Promise<string> {
  const text = instruction.trim();
  if (!text || !looksVietnamese(text)) return text;

  const apiKey = secret("GEMINI_API_KEY") ?? secret("GOOGLE_API_KEY");
  if (!apiKey) {
    // Better to render from the Vietnamese than to fail the job outright: the
    // result is usually poor, and the message on the history entry says why.
    throw new TranslationUnavailableError();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: MODEL,
      input: [{ type: "text", text: `${SYSTEM}\n\nVietnamese:\n${text}` }],
    });

    const out = interaction.output_text?.trim();
    if (!out) throw new Error("Gemini không trả về bản dịch.");
    return out;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Không dịch được câu lệnh sang tiếng Anh: ${message}`);
  }
}

export class TranslationUnavailableError extends Error {
  constructor() {
    super(
      "Engine này không hiểu tiếng Việt và chưa có GEMINI_API_KEY để dịch. " +
        "Hãy chọn engine Nano Banana (hiểu tiếng Việt trực tiếp), " +
        "nhập câu lệnh bằng tiếng Anh, hoặc thêm GEMINI_API_KEY ở mục Cài đặt.",
    );
    this.name = "TranslationUnavailableError";
  }
}
