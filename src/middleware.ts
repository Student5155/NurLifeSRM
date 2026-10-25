import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Всё, кроме статики, картинок, шрифтов и служебных файлов Next.js.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|fonts/|ornaments/|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)",
  ],
};
