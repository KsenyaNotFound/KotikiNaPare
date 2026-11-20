"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Student = { id: number; name: string; turn: number | null };
type State = { me: { id: number; name: string; room: string } | null; people: Student[] };

const sprite = [
  "................", "..##......##....", "..#p#....#p#....", "..#xx####xx#....",
  "..#xxxxxxxx#....", ".#xxxxxxxxxx#...", ".#xxoxxxxoxx#...", ".#xppxppxppx#...",
  "..#xxxxxxxx#....", "...########..##.", "....#xxxx#..#xx#", "...#xxxxxx##x#..",
  "...#xxxxxxxx#...", "...#xxxxxx##....", "....######......",
];

function Cat({ dark = false }: { dark?: boolean }) {
  const colors: Record<string, string> = { "#": "#392638", x: dark ? "#514052" : "#fff9fa", o: dark ? "#fff4f9" : "#392638", p: "#ed8eb5" };
  return <span className="cat" aria-hidden="true">{sprite.flatMap((row, y) => [...row].map((pixel, x) => pixel === "." ? null :
    <i key={y * 16 + x} style={{ background: colors[pixel], gridArea: `${y + 1} / ${x + 1}` }} />))}</span>;
}

export default function Home() {
  const [state, setState] = useState<State>({ me: null, people: [] });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const requestNumber = useRef(0);
  const changing = useRef(false);

  async function refresh() {
    const version = ++requestNumber.current;
    try {
      const response = await fetch("/api/classroom", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: State = await response.json();
      if (version === requestNumber.current) {
        setState(data);
        setReady(true);
        setOffline(false);
      }
    } catch {
      if (version === requestNumber.current) setOffline(true);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (!changing.current) void refresh(); }, 2500);
    return () => { clearInterval(timer); requestNumber.current++; };
  }, []);

  async function act(action: string, values = {}) {
    if (changing.current) return;
    changing.current = true;
    requestNumber.current++;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
    } catch (problem) {
      setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Не удалось связаться с сервером. Попробуйте ещё раз.");
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void act("join", { name: form.get("name"), room: form.get("room") });
  }

  const present = state.people.filter(person => person.turn === null);
  const [out, ...queue] = state.people.filter(person => person.turn !== null);
  const position = queue.findIndex(person => person.id === state.me?.id) + 1;
  const away = Boolean(out && out.id === state.me?.id);
  function item(person: Student, index: number, numbered = false) {
    return <li key={person.id}><span className="list-icon">{numbered ? index + 1 : "♥"}</span>
      <span>{person.name} {person.id === state.me?.id && <small>вы</small>}</span></li>;
  }

  return <main className="shell">
    <header><div className="brand"><span className="mark"><Cat dark /></span>Котики на паре</div>
      {state.me && <button className="quiet leave" disabled={busy} onClick={() => void act("leave")}>Покинуть пару</button>}
    </header>
    <section className="hero">
      <div className="intro">
        <div className="eyebrow"><span>♥</span> {state.me ? `Пара · ${state.me.room}` : "Электронная очередь"}</div>
        <h1>Котики <em>на паре</em></h1>
        <p>Нужно выйти? Займи очередь, и мы покажем, когда настанет твой черёд.</p>
      </div>
      <div className="art" aria-hidden="true"><span className="spark one">✦</span><span className="spark two">♥</span><span className="spark three">✦</span><div className="kitty black"><Cat dark /></div><div className="kitty white"><Cat /></div></div>
    </section>
    <section className="control" aria-label="Участие в паре">
      {!ready ? <p>{offline ? "Ожидаем соединения с сервером…" : "Загружаем пару…"}</p> : state.me ?
        <><div><strong>{state.me.name}</strong><p role="status">{away ? "Твой черёд! Можно выходить." : position ? `Твоё место в очереди — ${position}.` : "Ты сейчас на паре."}</p></div>
          <button className="primary" disabled={busy || offline} onClick={() => void act(away || position ? "finish" : "request")}>{away ? "Я вернулся / вернулась" : position ? "Отменить заявку" : "Хочу выйти"}</button></>
        : <form onSubmit={join}><div className="join-heading"><strong>Присоединиться к паре</strong><p>У всех студентов на паре должен быть одинаковый код.</p></div>
          <label>Имя<input name="name" autoComplete="given-name" placeholder="Например, Маша" required maxLength={40} disabled={busy} /></label>
          <label>Код пары<input name="room" autoCapitalize="none" spellCheck={false} placeholder="Например, математика-01" required minLength={3} maxLength={32} disabled={busy} /></label>
          <button className="primary" disabled={busy || offline} type="submit">{busy ? "Входим…" : "Войти"}</button>
        </form>}
    </section>
    {(error || (ready && offline)) && <p className="error" role="alert">{error || "Связь пропала. Восстанавливаем соединение…"}</p>}
    <div className="columns">
      <section className="card present"><h2><span className="icon">⌂</span>На паре <b>{present.length}</b></h2>
        {present.length ? <ul>{present.map((person, index) => item(person, index))}</ul> : <div className="empty">Здесь будут студенты, которые сейчас в аудитории.</div>}</section>
      <section className="card waiting"><h2><span className="icon">≡</span>В очереди <b>{queue.length}</b></h2>
        {queue.length ? <ol>{queue.map((person, index) => item(person, index, true))}</ol> : <div className="empty">Пока никто не ждёт.</div>}</section>
      <section className="card outside"><h2><span className="icon">↗</span>Вышел <b>{out ? 1 : 0}</b></h2>
        {out ? <ul>{item(out, 0)}</ul> : <div className="empty"><span className="mini-cat"><Cat /></span>Сейчас свободно</div>}</section>
    </div>
  </main>;
}