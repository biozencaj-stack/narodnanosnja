import { resolveServerSession } from "@/lib/auth/server-session";
import { createObjaviPostHandler } from "@/lib/sekcije/rute";
import {
  objaviStranicu,
  ponistiKes,
  prijaviNeuspeh,
} from "@/lib/sekcije/prisma-veze";

export const POST = createObjaviPostHandler({
  resolveSession: () => resolveServerSession(),
  objaviStranicu: objaviStranicu,
  ponistiKes: ponistiKes,
  reportFailure: prijaviNeuspeh,
});
