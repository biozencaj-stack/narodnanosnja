'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import ReclamationForm from '@/lib/models/ReclamationForm';
import { sendReclamationEmail } from '@/lib/email/mailer';
import { validateEmailAddress } from '@/lib/utils/validation';
import { useReCaptcha } from '@/hooks/useReCaptcha';
import { useStoreIdentity } from '@/components/StoreIdentityProvider';

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  itemCode: string;
  itemSize: string;
  orderNumber: string;
  fiscalNumber: string;
  desc: string;
  buyerRequest: number;
  honeypot: string;
}

const initialFormState: FormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  itemCode: '',
  itemSize: '',
  orderNumber: '',
  fiscalNumber: '',
  desc: '',
  buyerRequest: 0,
  honeypot: '',
};

export default function Reklamacije() {
  const {
    name: storeName,
    address: storeAddress,
    city: storeCity,
    email: storeEmail,
  } = useStoreIdentity();
  const [values, setValues] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [openModal, setOpenModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { executeRecaptcha } = useReCaptcha();

  const validate = (fieldValues: Partial<FormState> = values) => {
    const temp: Partial<Record<keyof FormState, string>> = { ...errors };

    if ('email' in fieldValues)
      temp.email = fieldValues.email
        ? validateEmailAddress(fieldValues.email)
          ? ''
          : 'Email adresa nije validna!'
        : 'Neophodno je uneti e-mail adresu!';

    if ('name' in fieldValues)
      temp.name = fieldValues.name ? '' : 'Ime i prezime su obavezni!';

    if ('address' in fieldValues)
      temp.address = fieldValues.address ? '' : 'Adresa je obavezna!';

    if ('city' in fieldValues)
      temp.city = fieldValues.city ? '' : 'Grad i poštanski broj su obavezni!';

    if ('phone' in fieldValues)
      temp.phone = fieldValues.phone ? '' : 'Telefon je obavezan!';

    if ('itemCode' in fieldValues)
      temp.itemCode = fieldValues.itemCode
        ? ''
        : 'Šifra artikla ili naziv artikla je obavezan parametar!';

    if ('itemSize' in fieldValues)
      temp.itemSize = fieldValues.itemSize
        ? ''
        : 'Veličina artikla je obavezan parametar!';

    if ('orderNumber' in fieldValues)
      temp.orderNumber = fieldValues.orderNumber
        ? ''
        : 'Broj porudžbine je obavezan parametar!';

    if ('fiscalNumber' in fieldValues)
      temp.fiscalNumber = fieldValues.fiscalNumber
        ? ''
        : 'Fiskalni broj je obavezan parametar!';

    if ('desc' in fieldValues)
      temp.desc = fieldValues.desc ? '' : 'Opis je obavezan parametar!';

    if ('honeypot' in fieldValues && fieldValues.honeypot) {
      temp.honeypot = 'Bot je detektovan.';
    }

    setErrors({ ...temp });
    return Object.values(temp).every((x) => x === '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues({
      ...values,
      [name]: value,
    });
    validate({ [name]: value } as Partial<FormState>);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (validate(values)) {
      setIsSubmitting(true);

      try {
        const recaptchaToken = await executeRecaptcha('reclamation');
        const form = e.target as HTMLFormElement;
        const fileInput = form.fileUpload as HTMLInputElement;
        const file = fileInput?.files?.[0];

        const reclamationForm = new ReclamationForm(
          values.name,
          values.email,
          values.phone,
          values.address,
          values.city,
          values.itemCode,
          values.itemSize,
          values.orderNumber,
          values.fiscalNumber,
          values.desc,
          values.buyerRequest
        );

        const maxSize = 2 * 1024 * 1024;
        if (file && file.size > maxSize) {
          throw new Error('\nMolimo vas da odaberete dokument veličine do 2MB.');
        }

        let attachment: { content: string; filename: string } | undefined;
        if (file) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
            reader.readAsDataURL(file);
          });
          attachment = {
            content: dataUrl.split(',')[1] || '',
            filename: file.name,
          };
        }

        const sent = await sendReclamationEmail(
          reclamationForm.formatMailBody(),
          { recaptchaToken, honeypot: values.honeypot },
          attachment,
        );
        if (!sent) throw new Error('FORM_NOT_ACCEPTED');

        setValues(initialFormState);
        setSuccessMessage('Uspešno poslato!');
        setErrorMessage('');
        setOpenModal(true);
      } catch {
        setErrorMessage('Došlo je do greške prilikom slanja emaila. Pokušajte ponovo.');
        setOpenModal(true);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-background-alt rounded-xl p-6 sm:p-12">
      <h2 className="text-xl font-semibold text-text mb-4">
        Informacije o reklamaciji
      </h2>
      <p className="text-sm leading-6 text-text-muted mb-6">
        Ukoliko ste robu kupili u online prodavnici, prilikom preuzimanja
        pošiljke molimo Vas da u prisustvu kurira proverite svoj paket. Ukoliko
        na njemu ima vidljivih oštećenja (pocepani delovi i ugnječenje) paket ne
        bi trebalo da preuzmete. U ovom slučaju molimo Vas da nas kontaktirate
        e-mail adresom {storeEmail} U najkraćem mogućem roku obavestićemo
        Vas o daljem postupanju.
      </p>
      <p className="text-sm leading-6 text-text-muted mb-6">
        Ukoliko ste primili pošiljku i nakon otvaranja kutije ustanovili da
        isporučena roba ne odgovara naručenoj ili podaci na računu nisu
        odgovarajući, molimo Vas da, najkasnije u roku od 24h od trenutka
        prijema pošiljke, kontaktirate nas na e-mail adresu{' '}
        <a
          className="text-primary hover:underline"
          href={`mailto:${storeEmail}`}
        >
          {storeEmail}
        </a>
      </p>
      <p className="text-sm leading-6 text-text-muted mb-6">
        Ukoliko se na kupljenom proizvodu pojave neusaglašenosti u smislu
        odredbi Zakona o zaštiti potrošača, molimo Vas da nas kontaktirate putem
        e-mail adrese{' '}
        <a
          className="text-primary hover:underline"
          href={`mailto:${storeEmail}`}
        >
          {storeEmail}
        </a>
      </p>
      <p className="text-sm leading-6 text-text-muted font-semibold mb-4">
        Da biste izvršili reklamaciju potrebno je da zajedno sa artiklom koji
        je predmet reklamacije pošaljete:
      </p>

      <ul className="list-disc ml-8 text-sm mb-6 text-text-muted">
        <li className="pb-2">Broj Vašeg računa ili porudžbine</li>
        <li className="pb-2">Šifru artikla i veličinu koju želite da reklamirate</li>
        <li className="pb-2">Opis problema koji imate</li>
      </ul>

      <p className="text-sm leading-6 text-text-muted mb-6">
        Tražene podatke možete dostaviti popunjavanjem formulara ispod, i slanjem
        reklamacionom odeljenju na {storeName} {storeAddress}
        {storeCity && `, ${storeCity}`} zajedno sa artiklom koji reklamirate, fotokopijom
        fiskalnog računa i reklamacionim listom, radnim danima od 09.00h do
        16.00h. ili lično u maloprodajnom objektu {storeName}.
      </p>

      <form onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold text-text mb-6">
          Reklamacioni formular
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <Input
              label="Ime i prezime *"
              name="name"
              value={values.name}
              onChange={handleChange}
              error={errors.name}
            />
          </div>
          <div>
            <Input
              label="Email *"
              type="email"
              name="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
            />
          </div>
          <div>
            <Input
              label="Telefon *"
              name="phone"
              value={values.phone}
              onChange={handleChange}
              error={errors.phone}
            />
          </div>
          <div>
            <Input
              label="Adresa *"
              name="address"
              value={values.address}
              onChange={handleChange}
              error={errors.address}
            />
          </div>
          <div>
            <Input
              label="Grad i poštanski broj *"
              name="city"
              value={values.city}
              onChange={handleChange}
              error={errors.city}
            />
          </div>
          <div>
            <Input
              label="Naziv i šifra artikla *"
              name="itemCode"
              value={values.itemCode}
              onChange={handleChange}
              error={errors.itemCode}
            />
          </div>
          <div>
            <Input
              label="Veličina *"
              name="itemSize"
              value={values.itemSize}
              onChange={handleChange}
              error={errors.itemSize}
            />
          </div>
          <div>
            <Input
              label="Broj porudžbine *"
              name="orderNumber"
              value={values.orderNumber}
              onChange={handleChange}
              error={errors.orderNumber}
            />
          </div>
          <div>
            <Input
              label="Fiskalni broj *"
              name="fiscalNumber"
              value={values.fiscalNumber}
              onChange={handleChange}
              error={errors.fiscalNumber}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Opis nesaobraznosti *"
              name="desc"
              value={values.desc}
              onChange={handleChange}
              error={errors.desc}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">
              Zahtev potrošača
            </label>
            <select
              name="buyerRequest"
              value={values.buyerRequest}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-md border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors bg-background"
            >
              <option value={0}>Zamena za drugi artikal</option>
              <option value={1}>Povrat novca</option>
              <option value={2}>Servis artikla</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label
              htmlFor="fileUpload"
              className="cursor-pointer bg-background rounded-md font-medium text-text hover:text-primary transition-colors px-4 py-3 border border-border flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
              </svg>
              <span>Odaberite fajl</span>
            </label>
            <input
              id="fileUpload"
              name="fileUpload"
              type="file"
              className="hidden"
              accept="image/*,.doc,.docx,.pdf,.txt,.odt,.rtf,.wps,.md"
            />
          </div>

          <div>
            {/* Honeypot */}
            <input
              type="text"
              name="honeypot"
              value={values.honeypot}
              style={{ display: 'none' }}
              onChange={handleChange}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" fullWidth isLoading={isSubmitting}>
              Pošalji formular
            </Button>
          </div>
        </div>
      </form>

      <p className="text-xs text-text-muted mb-4">
        Maksimalna veličina fajla: 2MB. <br />
        Dozvoljena ekstenzija (format) dokumenta kojeg prilažete je: pdf, docx, doc, xls, xlsx, jpg, png, jpeg <br />
        <strong>Polja označena zvezdicom su obavezna!</strong> <span className="text-red-600">*</span>
      </p>

      <p className="text-sm leading-6 text-text-muted mb-4">
        Odgovor na podneti zahtev, sa dokumentima i uputstvom za podnošenje
        reklamacije biće dostavljen na e-mail adresu koju ste ostavili putem
        popunjavanja. Odgovor na podnetu reklamaciju, takođe, ćete dobiti na
        e-mail adresu u predviđenom zakonskom roku.
      </p>
      <p className="text-sm leading-6 text-text-muted mb-4">
        Rok podnošenja reklamacije važi 24 meseca od datuma kupovine. Lice
        ovlašćeno za odobrenje reklamacija ima rok od 8 dana od prijema
        reklamacije da odgovori pisanim ili elektronskim putem na
        izjavljenu reklamaciju. Rok za rešavanje reklamacije ne sme da bude duži
        od 15 dana od dana podnošenja reklamacije.
      </p>

      <p className="text-sm leading-6 text-text-muted mb-4">
        Kontakt adresa za reklamacije je:{' '}
        <a href={`mailto:${storeEmail}`} className="text-primary hover:underline">
          {storeEmail}
        </a>
      </p>

      <p className="text-sm leading-6 text-text-muted mb-4">
        Ukoliko je reklamacija prihvaćena operater našeg call centra će Vas
        obavestiti putem e-maila koji ste naveli u reklamacionom listu.
        <br /><br />
        <strong>NAPOMENA:</strong> <br /><br />
        *Povrat novca se može izvršiti samo osobi koje je podnosilac reklamacije (ne treća lica).
      </p>

      <ul className="list-disc ml-8 text-sm mb-4 text-text-muted">
        <li className="pb-2">
          Zvaničan Pravilnik o reklamaciji potrošača za robu kupljenu putem
          internet prodavnice možete pronaći{' '}
          <a
            href="/docs/pravilnik-o-reklamaciji-potrosaca.pdf"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OVDE
          </a>.
        </li>
        <li className="pb-2">
          Reklamacioni list možete preuzeti{' '}
          <a
            href="/docs/obrazac_reklamacija.pdf"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OVDE
          </a>.
        </li>
      </ul>

      <p className="text-sm leading-6 text-text-muted">
        U slučaju vraćanja robe kupcu koji je prethodno robu platio kuriru tj.
        pouzećem, troškove vraćanja robe ne snosi {storeName}, već trošak pada
        na teret kupca.
        <br />
        Potvrdom porudžbine, klikom na dugme POTVRDI PORUDŽBINU, saglasni ste sa uslovima reklamacije.
      </p>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {successMessage ? 'Uspešno poslato!' : 'Greška'}
            </DialogTitle>
            <DialogDescription>
              {successMessage || errorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpenModal(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
