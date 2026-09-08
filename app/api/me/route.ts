import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  return Response.json({ user });
}
