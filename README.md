# MediDesk — Neon + Prisma integration

## Architecture

Browser (HTML/CSS/JS)
        |
        | HTTPS/API
        v
MediDesk Node/Express API
        |
        | Prisma
        v
Neon PostgreSQL

The browser never receives DATABASE_URL and never connects directly to Neon.

## Setup

1. Copy `.env.example` to `.env`.
2. Put your Neon PostgreSQL connection string in `DATABASE_URL`.
3. Generate a strong random `JWT_SECRET`.
4. Install dependencies:

   npm install

5. Generate Prisma client:

   npx prisma generate

6. Create the database tables:

   npx prisma migrate dev --name init

7. Add demo users/data:

   npm run seed

8. Start backend:

   npm run dev

9. Serve the frontend with VS Code Live Server on port 5500.

Demo accounts:
- Patient: alex@demo.com / Demo@12345
- Doctor: doctor@demo.com / Demo@12345
- Doctor: doctor2@demo.com / Demo@12345
- Admin: admin@demo.com / Demo@12345

## Security model

- Passwords are stored as bcrypt hashes, never plaintext.
- Authentication is handled by an HttpOnly session cookie containing a short-lived JWT.
- Authorization is enforced on the server.
- Patients can create and view only their own appointments.
- Doctors can view appointments assigned to them.
- Patient records require patient ownership or a granted doctor consent.
- Admins cannot use the patient-record route.
- Audit logs record important access decisions.
- Prisma parameterizes database operations.
- Neon credentials stay in the backend `.env`.
- Only synthetic data should be used for the hackathon demo.

## Important

This is an integration template. If your existing MediDesk backend already has authentication/routes/schema, do not overwrite it blindly. Merge the authorization checks and API calls into your existing routes/schema.
