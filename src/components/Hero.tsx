export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 pt-14 pb-10">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        How hard is it to get your OAuth app approved?
      </h1>
      <ul className="mt-6 flex flex-col gap-2 text-base text-zinc-600 dark:text-zinc-400 sm:flex-row sm:gap-8">
        <li>
          <span className="font-medium text-foreground">Size it</span> &mdash; difficulty tier, your time, and the wait
        </li>
        <li>
          <span className="font-medium text-foreground">Prepare it</span> &mdash; prerequisites and every step, with an owner
        </li>
        <li>
          <span className="font-medium text-foreground">Share it</span> &mdash; the three approval gates and who clears each one
        </li>
      </ul>
    </section>
  );
}
