'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useReCaptcha } from '@/hooks/useReCaptcha';
import { useStoreIdentity } from '@/components/StoreIdentityProvider';

interface FormData {
  name: string;
  surname: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  workingCity: string;
  additionalInfo: string;
  processData: boolean;
  honeypot: string;
}

interface FormErrors {
  [key: string]: string;
}

const initialFormState: FormData = {
  name: '',
  surname: '',
  email: '',
  gender: '',
  dateOfBirth: '',
  phoneNumber: '',
  workingCity: '',
  additionalInfo: '',
  processData: false,
  honeypot: '',
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^(\+381[0-9]{8,9}|0[0-9]{9})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export function JobForm() {
  const { name: storeName } = useStoreIdentity();
  const [values, setValues] = useState<FormData>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { executeRecaptcha } = useReCaptcha();

  const validate = (fieldValues: Partial<FormData> = values): boolean => {
    const temp: FormErrors = { ...errors };

    if ('name' in fieldValues) {
      temp.name = fieldValues.name ? '' : 'Ime je obavezno!';
    }
    if ('surname' in fieldValues) {
      temp.surname = fieldValues.surname ? '' : 'Prezime je obavezno!';
    }
    if ('email' in fieldValues) {
      temp.email = fieldValues.email
        ? validateEmail(fieldValues.email)
          ? ''
          : 'Email adresa nije validna!'
        : 'Neophodno je uneti e-mail adresu!';
    }
    if ('gender' in fieldValues) {
      temp.gender = fieldValues.gender ? '' : 'Pol je obavezan!';
    }
    if ('dateOfBirth' in fieldValues) {
      temp.dateOfBirth = fieldValues.dateOfBirth ? '' : 'Datum rođenja je obavezan!';
    }
    if ('phoneNumber' in fieldValues) {
      temp.phoneNumber = fieldValues.phoneNumber
        ? validatePhoneNumber(fieldValues.phoneNumber)
          ? ''
          : 'Broj telefona nije validan! (npr. +381601234567 ili 0601234567)'
        : 'Telefon je obavezan!';
    }
    if ('workingCity' in fieldValues) {
      temp.workingCity = fieldValues.workingCity ? '' : 'Grad je obavezan!';
    }
    if ('processData' in fieldValues) {
      temp.processData = fieldValues.processData ? '' : 'Saglasnost je obavezna!';
    }
    if ('honeypot' in fieldValues && fieldValues.honeypot) {
      temp.honeypot = 'Bot detected';
    }

    // Validate files
    if (files.length === 0) {
      temp.files = 'CV je obavezan!';
    } else {
      temp.files = '';
    }

    setErrors(temp);
    return Object.values(temp).every((x) => x === '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setValues((prev) => ({
      ...prev,
      [name]: newValue,
    }));
    validate({ [name]: newValue });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setValues((prev) => ({
      ...prev,
      dateOfBirth: date,
    }));
    validate({ dateOfBirth: date });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length + files.length > 2) {
      setErrors((prev) => ({ ...prev, files: 'Dozvoljeno je maksimalno 2 fajla!' }));
      return;
    }
    if (newFiles.some((file) => file.size > 5 * 1024 * 1024)) {
      setErrors((prev) => ({ ...prev, files: 'Jedan fajl može imati najviše 5MB.' }));
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setErrors((prev) => ({ ...prev, files: '' }));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (values.honeypot) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const recaptchaToken = await executeRecaptcha('job_application');
      // Read files as base64
      const fileDataPromises = files.map((file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      });

      const fileData = await Promise.all(fileDataPromises);
      const fileNames = files.map((f) => f.name);

      const response = await fetch('/api/job-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          files: fileData,
          fileNames,
          recaptchaToken,
        }),
      });

      if (response.ok) {
        setValues(initialFormState);
        setFiles([]);
        setShowSuccessModal(true);
      } else {
        const data = await response.json();
        setErrorMessage(data.error || 'Došlo je do greške. Pokušajte ponovo.');
      }
    } catch (error) {
      setErrorMessage('Došlo je do greške prilikom slanja. Pokušajte ponovo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-none">
      {/* Company Info */}
      <div className="mb-10">
        <h1 className="text-center">Pridruži se {storeName} timu!</h1>

        <hr className="my-8" />

        <p>
          {storeName} je sinonim za kvalitetnu i udobnu obuću koja traje. Ako želiš da postaneš
          deo našeg tima i doprineseš našem uspehu, sada je prava prilika!
        </p>
        <p>
          Tražimo posvećene i ambiciozne ljude koji dele našu strast prema inovacijama i
          vrhunskoj izradi obuće.
        </p>

        <h3>Zašto {storeName}?</h3>
        <ul>
          <li>Dugogodišnja tradicija i stabilnost</li>
          <li>Prijatno i motivišuće radno okruženje</li>
          <li>Mogućnost profesionalnog razvoja</li>
          <li>Konkurentne pogodnosti i beneficije</li>
        </ul>

        <hr className="my-8" />

        <p className="text-lg text-center font-semibold">
          Ako si spreman za nove izazove, popuni prijavu i pridruži nam se! 🚀
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-text mb-2">
              Ime <span className="text-error">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={values.name}
              onChange={handleChange}
              className={cn(
                'input',
                errors.name && 'border-error focus:border-error focus:ring-error-light'
              )}
            />
            {errors.name && <p className="text-error text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Surname */}
          <div>
            <label htmlFor="surname" className="block text-sm font-semibold text-text mb-2">
              Prezime <span className="text-error">*</span>
            </label>
            <input
              type="text"
              id="surname"
              name="surname"
              value={values.surname}
              onChange={handleChange}
              className={cn(
                'input',
                errors.surname && 'border-error focus:border-error focus:ring-error-light'
              )}
            />
            {errors.surname && <p className="text-error text-sm mt-1">{errors.surname}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-text mb-2">
              Email <span className="text-error">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={values.email}
              onChange={handleChange}
              className={cn(
                'input',
                errors.email && 'border-error focus:border-error focus:ring-error-light'
              )}
            />
            {errors.email && <p className="text-error text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Pol <span className="text-error">*</span>
            </label>
            <div className="flex items-center gap-6 h-12">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={values.gender === 'male'}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary border-border focus:ring-primary"
                />
                <span className="text-text">Muški</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={values.gender === 'female'}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary border-border focus:ring-primary"
                />
                <span className="text-text">Ženski</span>
              </label>
            </div>
            {errors.gender && <p className="text-error text-sm mt-1">{errors.gender}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-semibold text-text mb-2">
              Telefon <span className="text-error">*</span>
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={values.phoneNumber}
              onChange={handleChange}
              placeholder="+381601234567 ili 0601234567"
              className={cn(
                'input',
                errors.phoneNumber && 'border-error focus:border-error focus:ring-error-light'
              )}
            />
            {errors.phoneNumber && <p className="text-error text-sm mt-1">{errors.phoneNumber}</p>}
          </div>

          {/* Date of Birth */}
          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-text mb-2">
              Datum rođenja <span className="text-error">*</span>
            </label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={values.dateOfBirth}
              onChange={handleDateChange}
              className={cn(
                'input',
                errors.dateOfBirth && 'border-error focus:border-error focus:ring-error-light'
              )}
            />
            {errors.dateOfBirth && <p className="text-error text-sm mt-1">{errors.dateOfBirth}</p>}
          </div>

          {/* City */}
          <div>
            <label htmlFor="workingCity" className="block text-sm font-semibold text-text mb-2">
              Grad <span className="text-error">*</span>
            </label>
            <input
              type="text"
              id="workingCity"
              name="workingCity"
              value={values.workingCity}
              onChange={handleChange}
              className={cn(
                'input',
                errors.workingCity && 'border-error focus:border-error focus:ring-error-light'
              )}
            />
            {errors.workingCity && <p className="text-error text-sm mt-1">{errors.workingCity}</p>}
          </div>

          {/* Data consent */}
          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="processData"
                checked={values.processData}
                onChange={handleChange}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold text-text">
                Slažem se sa obradom podataka <span className="text-error">*</span>
              </span>
            </label>
            {errors.processData && <p className="text-error text-sm ml-8">{errors.processData}</p>}
          </div>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="additionalInfo" className="block text-sm font-semibold text-text mb-2">
            Tekst poruke
          </label>
          <textarea
            id="additionalInfo"
            name="additionalInfo"
            value={values.additionalInfo}
            onChange={handleChange}
            rows={5}
            className="input resize-none"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-semibold text-text mb-2">
            CV <span className="text-error">*</span> (Maksimalno 2 fajla)
          </label>
          <div className="relative">
            <div className="flex items-center gap-3 p-4 border border-dashed border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <Upload className="h-6 w-6 text-text-muted" />
              <span className="font-medium text-text">Odaberite fajlove</span>
              <input
                type="file"
                multiple
                accept="image/*,.doc,.docx,.pdf,.txt,.odt,.rtf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-background-alt rounded-lg">
                  <span className="text-sm text-text">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-error hover:text-error/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {errors.files && <p className="text-error text-sm mt-1">{errors.files}</p>}
        </div>

        {/* Honeypot */}
        <input
          type="text"
          name="honeypot"
          value={values.honeypot}
          onChange={handleChange}
          style={{ display: 'none' }}
          tabIndex={-1}
          autoComplete="off"
        />

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-4 bg-error-light text-error rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          isLoading={isSubmitting}
          className="w-full md:w-auto"
        >
          Pošalji prijavu
        </Button>
      </form>

      {/* Success Modal */}
      <Dialog.Root open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-2xl p-8 shadow-xl z-50 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <Dialog.Title className="font-display text-2xl text-text mb-2">
                Uspešno poslato!
              </Dialog.Title>
              <Dialog.Description className="text-text-muted mb-6">
                Vaša prijava je uspešno primljena. Kontaktiraćemo vas u najkraćem mogućem roku.
              </Dialog.Description>
              <Button onClick={() => setShowSuccessModal(false)}>
                Zatvori
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
