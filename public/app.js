const select = selector => document.querySelector(selector);
const form = select("form");
const actionButton = select("#action");
const leaveButton = select(".leave");
const loading = select("#loading");
const error = select(".error");
const account = select("#account");
const sprite = [
  "................", "..##......##....", "..#p#....#p#....", "..#xx####xx#....",
  "..#xxxxxxxx#....", ".#xxxxxxxxxx#...", ".#xxoxxxxoxx#...", ".#xppxppxppx#...",
  "..#xxxxxxxx#....", "...########..##.", "....#xxxx#..#xx#", "...#xxxxxx##x#..",
  "...#xxxxxxxx#...", "...#xxxxxx##....", "....######......",
];

for (const element of document.querySelectorAll("[data-cat]")) {
  const dark = element.dataset.cat === "dark";
  const colors = { "#": "#392638", x: dark ? "#514052" : "#fff9fa", o: dark ? "#fff4f9" : "#392638", p: "#ed8eb5" };
  const cat = document.createElement("span");
  cat.className = "cat";
  cat.setAttribute("aria-hidden", "true");
  sprite.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === ".") return;
    const cell = document.createElement("i");
    cell.style.background = colors[pixel];
    cell.style.gridArea = (y + 1) + " / " + (x + 1);
    cat.append(cell);
  }));
  element.append(cat);
}

let pending = false;
let offline = false;
let version = 0;
let lastState = "";
let action = "request";

function disableControls() {
  for (const button of document.querySelectorAll("button")) button.disabled = pending || offline;
}

function renderList(selector, people, me, numbered = false) {
  const card = select(selector);
  const list = card.querySelector("ul, ol");
  card.querySelector("b").textContent = people.length;
  card.querySelector(".empty").hidden = people.length > 0;
  list.hidden = people.length === 0;
  list.replaceChildren(...people.map((person, index) => {
    const item = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "list-icon";
    icon.textContent = numbered ? index + 1 : "♥";
    icon.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent = person.name;
    if (person.id === me?.id) {
      const marker = document.createElement("small");
      marker.textContent = "вы";
      name.append(" ", marker);
    }
    item.append(icon, name);
    return item;
  }));
}

function render({ me, people }) {
  loading.hidden = true;
  form.hidden = Boolean(me);
  account.hidden = actionButton.hidden = leaveButton.hidden = !me;
  const present = people.filter(person => person.turn === null);
  const [out, ...queue] = people.filter(person => person.turn !== null);
  renderList(".present", present, me);
  renderList(".waiting", queue, me, true);
  renderList(".outside", out ? [out] : [], me);
  select("#room-label").textContent = me ? "Пара · " + me.room : "Электронная очередь";
  if (!me) return;
  const position = queue.findIndex(person => person.id === me.id) + 1;
  const away = out?.id === me.id;
  account.querySelector("strong").textContent = me.name;
  account.querySelector("p").textContent = away ? "Твой черёд! Можно выходить." :
    position ? "Твоё место в очереди — " + position + "." : "Ты сейчас на паре.";
  action = away || position ? "finish" : "request";
  actionButton.textContent = away ? "Я вернулся / вернулась" : position ? "Отменить заявку" : "Хочу выйти";
}

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}

async function refresh() {
  const current = ++version;
  try {
    const response = await fetch("/api/classroom", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (current !== version) return;
    if (offline) showError("");
    offline = false;
    const nextState = JSON.stringify(data);
    if (nextState !== lastState) {
      render(data);
      lastState = nextState;
    }
  } catch {
    if (current !== version) return;
    offline = true;
    if (!loading.hidden) loading.textContent = "Ожидаем соединения с сервером…";
    else showError("Связь пропала. Восстанавливаем соединение…");
  }
  disableControls();
}

async function send(command, values = {}) {
  if (pending || offline) return;
  pending = true;
  version++;
  disableControls();
  showError("");
  try {
    const response = await fetch("/api/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: command, ...values }),
    });
    const data = await response.json();
    if (!response.ok) {
      showError(data.error || "Действие не выполнено. Попробуйте ещё раз.");
      return;
    }
    if (command === "join") form.reset();
    await refresh();
  } catch {
    showError("Не удалось связаться с сервером. Попробуйте ещё раз.");
  } finally {
    pending = false;
    disableControls();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  send("join", Object.fromEntries(new FormData(form)));
});
actionButton.addEventListener("click", () => send(action));
leaveButton.addEventListener("click", () => send("leave"));
refresh();
setInterval(() => { if (!pending) refresh(); }, 2500);