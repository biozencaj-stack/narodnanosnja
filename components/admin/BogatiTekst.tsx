"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIkona,
} from "lucide-react";

/**
 * Uređivač bogatog teksta za polja sekcija.
 *
 * Traka nudi ISKLJUČIVO ono što preživi `lib/security/html.ts`. To je pravilo,
 * ne ukus: poravnanje teksta (`TextAlign`) proizvodi `style="text-align:…"`, a
 * beli spisak ne dozvoljava `style` ni na jednom elementu — dugme bi radilo u
 * uređivaču, a poravnanje bi nestalo pri snimanju. Takva „greška” se ne
 * prijavljuje nigde; korisnik samo vidi da mu se rad izgubio.
 *
 * Slike se ovde ne ubacuju. Za njih postoje polja tipa `medij`, koja nose i
 * `alt` tekst i prolaze kroz proveru putanje.
 *
 * `NewsletterEditor` namerno ostaje na svojoj postavci: treba mu ubacivanje
 * slika i imperativni `ref`, pa bi njegovo prevođenje na ovu komponentu
 * značilo rizik za newsletter bez ikakve koristi za sekcije.
 */

interface BogatiTekstProps {
  vrednost: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

const KLASA_DUGMETA =
  "p-1.5 rounded hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent";
const KLASA_AKTIVNOG = "bg-stone-200 text-stone-900";

export function BogatiTekst({
  vrednost,
  onChange,
  disabled = false,
}: BogatiTekstProps) {
  const [prikaziVezu, setPrikaziVezu] = useState(false);
  const [urlVeze, setUrlVeze] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
      Underline,
    ],
    content: vrednost,
    editable: !disabled,
    // Bez ovoga se server i klijent razlikuju pri prvom iscrtavanju.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[140px] px-3 py-2",
      },
    },
  });

  // Kad se promeni izabrana sekcija, isti uređivač dobija drugi sadržaj.
  // Bez ovoga bi zadržao tekst prethodne sekcije.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === vrednost) return;
    editor.commands.setContent(vrednost, { emitUpdate: false });
  }, [editor, vrednost]);

  const dodajVezu = useCallback(() => {
    if (!editor) return;
    const url = urlVeze.trim();
    if (url.length === 0) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setUrlVeze("");
    setPrikaziVezu(false);
  }, [editor, urlVeze]);

  if (!editor) {
    return (
      <div className="border border-stone-300 rounded-lg min-h-[180px] bg-stone-50" />
    );
  }

  const dugme = (
    kljuc: string,
    naslov: string,
    aktivno: boolean,
    akcija: () => void,
    Ikona: typeof Bold,
  ) => (
    <button
      key={kljuc}
      type="button"
      title={naslov}
      aria-label={naslov}
      aria-pressed={aktivno}
      disabled={disabled}
      onClick={akcija}
      className={`${KLASA_DUGMETA} ${aktivno ? KLASA_AKTIVNOG : "text-stone-600"}`}
    >
      <Ikona className="h-4 w-4" />
    </button>
  );

  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-200 px-2 py-1.5 bg-stone-50">
        {dugme("bold", "Podebljano", editor.isActive("bold"), () =>
          editor.chain().focus().toggleBold().run(), Bold)}
        {dugme("italic", "Kurziv", editor.isActive("italic"), () =>
          editor.chain().focus().toggleItalic().run(), Italic)}
        {dugme("underline", "Podvučeno", editor.isActive("underline"), () =>
          editor.chain().focus().toggleUnderline().run(), UnderlineIkona)}
        {dugme("strike", "Precrtano", editor.isActive("strike"), () =>
          editor.chain().focus().toggleStrike().run(), Strikethrough)}

        <span className="mx-1 h-4 w-px bg-stone-300" />

        <button
          type="button"
          title="Podnaslov"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`${KLASA_DUGMETA} text-xs font-semibold ${
            editor.isActive("heading", { level: 2 }) ? KLASA_AKTIVNOG : "text-stone-600"
          }`}
        >
          H2
        </button>
        <button
          type="button"
          title="Manji podnaslov"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`${KLASA_DUGMETA} text-xs font-semibold ${
            editor.isActive("heading", { level: 3 }) ? KLASA_AKTIVNOG : "text-stone-600"
          }`}
        >
          H3
        </button>

        <span className="mx-1 h-4 w-px bg-stone-300" />

        {dugme("ul", "Lista", editor.isActive("bulletList"), () =>
          editor.chain().focus().toggleBulletList().run(), List)}
        {dugme("ol", "Numerisana lista", editor.isActive("orderedList"), () =>
          editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {dugme("quote", "Citat", editor.isActive("blockquote"), () =>
          editor.chain().focus().toggleBlockquote().run(), Quote)}
        {dugme("link", "Veza", editor.isActive("link"), () => {
          setUrlVeze(editor.getAttributes("link").href ?? "");
          setPrikaziVezu((prethodno) => !prethodno);
        }, Link2)}
      </div>

      {prikaziVezu && (
        <div className="flex gap-2 border-b border-stone-200 px-2 py-2 bg-stone-50">
          <input
            type="url"
            value={urlVeze}
            onChange={(dogadjaj) => setUrlVeze(dogadjaj.target.value)}
            placeholder="https://… ili /nosnje/sumadija"
            aria-label="Adresa veze"
            className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={dodajVezu}
            className="rounded bg-stone-800 px-3 py-1 text-sm text-white"
          >
            {urlVeze.trim().length === 0 ? "Ukloni" : "Postavi"}
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
