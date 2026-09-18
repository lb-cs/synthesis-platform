import type { Metadata } from 'next';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · Synthesis Platform',
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <LoginForm />
    </main>
  );
}
