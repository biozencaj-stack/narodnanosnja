'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import ContactUs from '@/lib/models/ContactUs';
import { sendContactEmail } from '@/lib/email/mailer';
import { validateEmailAddress } from '@/lib/utils/validation';
import { useReCaptcha } from '@/hooks/useReCaptcha';
import { useStoreIdentity } from '@/components/StoreIdentityProvider';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone: string;
  honeypot: string;
}

const initialFormState: FormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
  phone: '',
  honeypot: '',
};

export default function KontaktPage() {
  const {
    name: storeName,
    address: storeAddress,
    city: storeCity,
    email: storeEmail,
    phone: storePhone,
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
        : 'Neophodno je uneti e-mail adresu';

    if ('name' in fieldValues)
      temp.name = fieldValues.name ? '' : 'Ime je obavezno';

    if ('subject' in fieldValues)
      temp.subject = fieldValues.subject ? '' : 'Svrha je obavezna';

    if ('message' in fieldValues)
      temp.message = fieldValues.message ? '' : 'Poruka je obavezna';

    if ('phone' in fieldValues)
      temp.phone = fieldValues.phone ? '' : 'Telefon je obavezan';

    if ('honeypot' in fieldValues && fieldValues.honeypot) {
      temp.honeypot = 'Bot je detektovan.';
    }

    setErrors({ ...temp });
    return Object.values(temp).every((x) => x === '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues({
      ...values,
      [name]: value,
    });
    validate({ [name]: value } as Partial<FormState>);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (validate()) {
      setIsSubmitting(true);

      try {
        const recaptchaToken = await executeRecaptcha('contact');
        const contactForm = new ContactUs(
          values.name,
          values.email,
          values.phone,
          values.subject,
          values.message
        );

        const sent = await sendContactEmail(contactForm.formatMailBody(), {
          recaptchaToken,
          honeypot: values.honeypot,
        });
        if (!sent) throw new Error('FORM_NOT_ACCEPTED');
        setValues(initialFormState);
        setOpenModal(true);
        setSuccessMessage('Uspešno poslato!');
        setErrorMessage('');
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
      {/* Company Info */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text mb-4">{storeName}</h2>
        <p className="text-sm text-text-muted mb-2">
          {storeAddress} <br />
          {storeCity ? `${storeCity}, Srbija` : 'Srbija'}
        </p>
        <p className="text-sm text-text-muted mb-2">
          <a href={`mailto:${storeEmail}`} className="text-primary hover:underline">
            {storeEmail}
          </a>
        </p>
        <p className="text-sm text-text-muted">
          {storePhone}
        </p>

        {/* Google Maps placeholder - set your address in .env */}
        <div className="mt-6 w-full h-64 rounded-lg overflow-hidden shadow-sm bg-background-alt flex items-center justify-center">
          <p className="text-text-muted text-sm">Mapa lokacije - podesite adresu u podešavanjima</p>
        </div>
      </div>

      {/* Contact Form */}
      <div>
        <h2 className="text-xl font-semibold text-text mb-6">Pišite nam...</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Ime i prezime"
              name="name"
              value={values.name}
              onChange={handleChange}
              error={errors.name}
            />
            <Input
              label="Email"
              type="email"
              name="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Telefon"
              name="phone"
              value={values.phone}
              onChange={handleChange}
              error={errors.phone}
            />
            <Input
              label="Svrha poruke"
              name="subject"
              value={values.subject}
              onChange={handleChange}
              error={errors.subject}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">
              Tekst poruke
            </label>
            <textarea
              name="message"
              value={values.message}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-3 rounded-md border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors resize-none bg-background"
            />
            {errors.message && <p className="text-red-600 mt-2 text-sm">{errors.message}</p>}
          </div>

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

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSubmitting}>
              Pošaljite poruku
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {successMessage ? 'Uspešno poslato!' : 'Greška'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-text-muted">{successMessage || errorMessage}</p>
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
