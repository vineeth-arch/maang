import Link from 'next/link';
export function KeyError({ missing }: { missing: boolean }) {
  return <main className="min-h-screen bg-board-bg p-8 text-board-fg">
    <p className="font-display text-3xl font-semibold">{missing ? 'This board link is missing its key. Open the link you were given.' : 'This key is wrong or has changed.'}</p>
    <Link prefetch={false} className="mt-6 inline-block underline" href="/demo">See the demo view</Link>
  </main>;
}
