import { storeName, storeAddress, storeCity, storeEmail, storePhone } from "@/lib/config/store";

export default class JobForm {
  name: string;
  surname: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  workingCity: string;
  additionalInfo: string;

  constructor(
    name: string = '',
    surname: string = '',
    email: string = '',
    gender: string = '',
    dateOfBirth: string = '',
    phoneNumber: string = '',
    workingCity: string = '',
    additionalInfo: string = ''
  ) {
    this.name = name;
    this.surname = surname;
    this.email = email;
    this.gender = gender;
    this.dateOfBirth = dateOfBirth;
    this.phoneNumber = phoneNumber;
    this.workingCity = workingCity;
    this.additionalInfo = additionalInfo;
  }

  translateGender(): string {
    if (this.gender) {
      if (this.gender === 'male') return 'Muški pol';
      else return 'Ženski pol';
    }
    return '';
  }

  formatMailBody(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Podaci o korisniku</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f8f8f8;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
        }
        h2 {
            text-align: center;
            color: #005229;
        }
        .info {
            margin-top: 20px;
            padding: 15px;
            background-color: #e0f7fa;
            border-radius: 5px;
        }
        .info p {
            margin: 8px 0;
            color: #333;
        }
        .contact-info {
            margin-top: 20px;
            text-align: center;
            font-size: 14px;
            color: #555;
        }
    </style>
</head>
<body>
<div class="container">
    <h2>Podaci o korisniku</h2>
    <div class="info">
        <p><strong>Ime i prezime: </strong>${this.name} ${this.surname}</p>
        <p><strong>Email: </strong>${this.email}</p>
        <p><strong>Pol: </strong>${this.translateGender()}</p>
        <p><strong>Datum rođenja: </strong>${this.dateOfBirth}</p>
        <p><strong>Telefon: </strong>${this.phoneNumber}</p>
        <p><strong>Grad rada: </strong>${this.workingCity}</p>
        <p><strong>Dodatne informacije: </strong>${this.additionalInfo || 'Nema dodatnih informacija'}</p>
    </div>
    <div class="contact-info">
        <p><strong>${storeName}</strong></p>
        <p>${storeAddress}${storeAddress && storeCity ? ", " : ""}${storeCity}${storeAddress || storeCity ? ", Srbija" : "Srbija"}</p>
        <p>Email: ${storeEmail}</p>
        <p>Telefon: ${storePhone}</p>
    </div>
</div>
</body>
</html>
`;
  }
}
