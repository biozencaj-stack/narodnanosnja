import { resolveServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db";
import {
  createSekcijaDeleteHandler,
  createSekcijaPutHandler,
} from "@/lib/sekcije/rute";
import {
  izmeniUslovno,
  nadjiSekciju,
  obrisiUslovno,
  ponistiKes,
  prijaviNeuspeh,
} from "@/lib/sekcije/prisma-veze";

export const PUT = createSekcijaPutHandler({
  resolveSession: () => resolveServerSession(),
  nadjiSekciju: nadjiSekciju,
  izmeniUslovno: izmeniUslovno,
  ucitaj: (id) => prisma.pageSection.findUnique({ where: { id } }),
  ponistiKes: ponistiKes,
  reportFailure: prijaviNeuspeh,
});

export const DELETE = createSekcijaDeleteHandler({
  resolveSession: () => resolveServerSession(),
  nadjiSekciju: nadjiSekciju,
  obrisiUslovno: obrisiUslovno,
  ponistiKes: ponistiKes,
  reportFailure: prijaviNeuspeh,
});
