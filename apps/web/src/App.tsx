export function App() {
  return (
    <main className="shell min-h-dvh flex flex-col items-center justify-center text-center">
      <header>
        <p className="eyebrow">A SRI LANKAN TRADITION</p>
        <h1>
          OMI<span lang="si">ඕමි</span>
        </h1>
      </header>
      <div className="suits" aria-hidden="true">
        ♠ <span>♥ ♦</span> ♣
      </div>
      <section aria-labelledby="welcome">
        <h2 id="welcome">Four friends. One table.</h2>
        <p>
          A familiar game. A little friendly rivalry.
          <br />A place to come together.
        </p>
        <p className="status" role="status">
          Your table is taking shape.
        </p>
      </section>
      <footer>Made for the way we play.</footer>
    </main>
  );
}
