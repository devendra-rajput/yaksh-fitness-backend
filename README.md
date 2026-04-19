## 🛠️ Setup Instructions

### 📦 Requirements

- Node.js v20
- MongoDB v5+

---

### 🔧 Installation Steps

1. **Clone the Repository**

```bash
git clone <repo-url>
cd <repo-directory>
```

2. **Install Dependencies**

```bash
npm install
```

3. **Configure Environment Variables**

```bash
cp .env.example .env
# Fill in DB credentials, JWT secrets, mail, etc.
```

4. **Run the Application**

```bash
npm run dev   # Development mode
npm run start # Production mode
```

---

## 🛡️ Authentication & Email Verification

- JWT-based auth (access and refresh tokens)
- Email verification using Nodemailer
- Secure token expiration & regeneration

---

## 🌍 Multi-language Support

- Integrated using `i18n`
- Language detected via `Accept-Language` header
- Language JSON files in `/locales`

---

## 📦 File Upload

- Supports:
  - Local file upload (development)
  - AWS S3 upload (production)

---

## 📊 Pagination

- Offset-based pagination (using `limit`, `page`)

---

## 📄 License

This project is licensed under the MIT License.
