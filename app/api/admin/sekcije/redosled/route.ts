import { resolveServerSession } from "@/lib/auth/server-session";
import { createRedosledPostHandler } from "@/lib/sekcije/rute";
import {
  ponistiKes,
  presloziUTransakciji,
  prijaviNeuspeh,
} from "@/lib/sekcije/prisma-veze";

export const POST = createRedosledPostHandler({
  resolveSession: () => resolveServerSession(),
  presloziUTransakciji: presloziUTransakciji,
  ponistiKes: ponistiKes,
  reportFailure: prijaviNeuspeh,
});
