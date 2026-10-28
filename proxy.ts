import { NextResponse, type NextRequest } from "next/server";

// Verificação otimista: sem cookie de sessão, vai para o login.
// A verificação a sério (token, conta ativa, permissões) é feita no servidor em cada página e ação.
export function proxy(req: NextRequest) {
  const has = req.cookies.has("__Host-cs_session") || req.cookies.has("cs_session");
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Ficheiros da app (PWA) têm de abrir sem sessão: o service worker, o manifesto, ícones e a página offline
  matcher: ["/((?!entrar|api|_next/static|_next/image|favicon.ico|icon|icons/|apple-icon|manifest|sw.js|offline.html|splash/|screenshots/).*)"],
};
