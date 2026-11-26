import { redirect } from 'next/navigation';
import { getSessionUser, homePathFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  redirect(homePathFor(user.role));
}
