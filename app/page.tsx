import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="label-mono text-muted">MAANG</p>
      <h1 className="font-display text-5xl font-bold leading-none">Jo bika nahi, woh bhi ginti mein.</h1>
      <p className="text-lg text-muted">
        Payments show what sold. MAANG shows what customers tried to buy.
      </p>
      <Link
        href="/s/neighbourhood-toys"
        className="inline-flex min-h-12 w-fit items-center rounded-full bg-ink px-6 text-bg"
      >
        Demo shop: Neighbourhood Toys (demo)
      </Link>
    </main>
  );
}
