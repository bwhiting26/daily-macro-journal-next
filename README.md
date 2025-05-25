This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variable Setup

This project requires two main environment configuration files that are **not** committed to version control:

1.  **`.env.local`**: Located in the project root. This file is used for frontend Next.js application variables. The primary required variables are:
    ```
    NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
    ```

2.  **`backend/.env`**: Located in the `backend/` directory. This file is used for the backend Node.js server variables. The primary required variables are:
    ```
    FATSECRET_CLIENT_ID="your_fatsecret_client_id"
    FATSECRET_CLIENT_SECRET="your_fatsecret_client_secret"
    ANTHROPIC_API_KEY="your_anthropic_api_key"
    ```

**Note on Precedence:** For the backend server (`backend/server.js`), environment variables loaded from `backend/.env` take precedence over any similarly named variables that might exist in the root `.env.local` file. This is due to the specific loading order implemented with the `dotenv` package.

**Example Files:** To guide users in setting up these files, example files like `.env.example` (in the root) and `backend/.env.example` (in the `backend/` directory) should ideally be created. These would list the required variables without their actual values. (Creating these example files is not part of the current task).

**Version Control:** Both `.env.local` and `backend/.env` are intentionally excluded from version control and are listed in the project's `.gitignore` file to ensure sensitive credentials are not committed.

## Architectural Overview

The application has undergone several refactoring efforts to improve maintainability and structure:

*   **Frontend State Management & Data Fetching:** The main dashboard functionality in `app/page.tsx` has been significantly refactored for improved maintainability. Key state management and data fetching logic have been extracted into custom React hooks located in the `app/hooks/` directory. These include `useUserSettings.ts` for managing user goals, `useJournalData.ts` for handling food entries and related statistics, and `useDailyQuote.ts` for the motivational quote feature.

*   **Centralized Types:** Shared data types and interfaces, such as `Entry` (for food journal entries) and `AppNotification` (for in-app notifications), are now centralized in `app/types.ts` for better consistency and reusability across the frontend application.

*   **Backend Services:** The `backend/server.js` file provides dedicated API endpoints for:
    *   Interacting with the FatSecret API (for food database search), including robust token management.
    *   Interacting with the Anthropic Claude API (for generating snack suggestions and daily reports).
    *   It also handles its own environment variable configuration, separate from the Next.js frontend.
